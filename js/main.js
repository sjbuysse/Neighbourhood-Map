/*jshint esversion: 6 */
var module = (function(){
    //global variables for the google map, google infowindow, viewmodel and logged in user instance
    var map;
    var infoWindow;
    var vm;
    var user;

    //Object that holds the methods that we need to access from outside this module
    var methods = {};

    //Model for places
    var Place = function(name, info, id, latlng, draggable){
        this.name = ko.observable(name);
        this.latlng = ko.observable(latlng);
        this.info = ko.observable(info);
        this.id = id;
        this.editing = ko.observable(false);
        this.draggable = ko.observable(draggable);
        this.visible = ko.observable(true);
        this.selected = ko.observable(false);
        this.images = ko.observableArray([]);
        // Only create markers if the google API is working.
        if(typeof google){
            this.marker = this.createMarker();
        }
        // Only create a firebase reference if a user has logged in;
        if(user){
            this.placeRef = firebase.database().ref().child('userObjects')
                .child('places').child(user.uid).child(this.id);
        }
    };

    //Create a marker for the place
    Place.prototype.createMarker = function() {
        var self = this;
        var marker = new google.maps.Marker({
            position: self.latlng(),
            title: self.name(),
            id: self.id,
            map: map,
            draggable: true, 
            animation: google.maps.Animation.DROP
        });
        ko.computed(function(){
            marker.setVisible(self.visible());
        });
        ko.computed(function(){
            marker.setDraggable(self.draggable());
        });
        ko.computed(function(){
            marker.setPosition(self.latlng());
        });
        ko.computed(function(){
            if(self.draggable()){
                marker.setIcon( 'http://maps.google.com/mapfiles/ms/icons/green-dot.png');
            } else if(self.selected()) {
                marker.setIcon( 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png');
            } else {
                marker.setIcon( 'http://maps.google.com/mapfiles/ms/icons/red-dot.png');
            }
        });
        marker.addListener('click', (function(self){
            return function(){
                if(vm.setSelectedPlace(self)) {
                    vm.populateInfowindow(marker);
                }
            };
        })(self));
        return marker;
    };
//make variables for images.forEach(function(image){image.caption}),  and be able to edit them. 
//change export, so that it exports also these captions and that they be automatically uploaded
//when saving th edit
    //Method to set the place in edit mode
    Place.prototype.setEditing = function(){
        var self = this;
        this.editing(true);
        this.previousName = this.name();
        this.previousInfo = this.info();
        this.previousImages = [];
        this.images().forEach(function(image){
            self.previousImages.push(image.export());
        });
    };

    Place.prototype.setDraggable = function() {
        this.draggable(true);
        this.previousLatLng = this.latlng();
    };

    Place.prototype.undoEditing = function(){
        var self = this;
        this.editing(false);
        this.name(this.previousName);
        this.info(this.previousInfo);
        // Reset caption
        this.previousImages.forEach(function(prevImage){
            var image = this.images.filter(function(image){
                return image.key === prevImage.key;
            });
            image.caption(prevImage.caption);
        });
    };

    Place.prototype.saveEditing = function(){
        var self = this;
        this.editing(false);
        this.placeRef.set(self.export(), function(err){
            if(err){
                console.log("error: " + err);
            }
        });
        this.images().forEach(function(imageObject){
            imageRef = firebase.database().ref().child('images/' + self.id + "/" + imageObject.key);
            imageRef.set(imageObject.export());
        });
    };

    Place.prototype.updateLocation = function(){
        var self = this;
        this.draggable(false);
        var newLocation = {
            lat: this.marker.getPosition().lat(),
            lng: this.marker.getPosition().lng()
        };
        this.latlng(newLocation);
        this.placeRef.update({latlng: newLocation});
    };


    Place.prototype.toPreviousLocation = function() {
        this.draggable(false);
        this.latlng(this.previousLatLng);
    };

    //This is the information we'd like to export, so that we exclude the marker property
    //If you add something here, make sure you adjust the createPlace function for importing the localStorage data correctly
    Place.prototype.export = function() {
        return {
            name: this.name(),
            info: this.info(),
            id: this.id,
            latlng: this.latlng(),
        };
    };

    var Image = function(url, caption, name, key){
        this.url = ko.observable(url);
        this.caption = ko.observable(caption);
        this.name = ko.observable(name);
        this.key = key;
        this.imageRef = vm.imagesRef.child(this.key);
    };

    Image.prototype.export = function() {
        return {
            url: this.url(),
            caption: this.caption(),
            name: this.name(),
            key: this.key
        };
    };

    //ViewModel
    var ViewModel = function(){
        var self = this;

        //Observables to keep track of the state of the UI
        this.showDrawer = ko.observable(false);
        this.showLargeInfoWindow = ko.observable(false);
        this.creatingPlace = ko.observable(false);

        //Methods to toggle state of UI
        this.toggleShowDrawer = function(){
            if(self.places.length === 0 || !self.selectedPlace().draggable()) {
                self.showDrawer(!self.showDrawer());
                if(self.showDrawer){
                    self.creatingPlace(false);
                }
            } else {
                alert("Please drag and save the green pin before doing something else.");
            }
        };
        this.toggleCreatingPlace = function(){
            if(self.googleDefined && (self.places.length === 0 || !self.selectedPlace().draggable())){
                self.creatingPlace(!self.creatingPlace());
                if(self.creatingPlace){
                    self.showDrawer(false);
                    self.showLargeInfoWindow(false);
                }
            } else if(!self.googleDefined) {
                alert("You can't create a new place at the moment, because the google API has trouble loading.");
            } else if(self.selectedPlace().draggable()) {
                alert("Please drag and save the green pin before doing something else.");
            }
        };
        this.toggleShowLargeInfoWindow = function(){
            self.showLargeInfoWindow(!self.showLargeInfoWindow());
        };

        //Current value in the searchBox
        this.filterValue = ko.observable('');

        this.createPlace = function(name, info, id, latlng = {lat: map.getCenter().lat(),lng: map.getCenter().lng()}, draggable = false) {
            var place = new Place(name, info, id, latlng, draggable);
            return place;
        };

        //When we click on a list item, we want to open up the infowindow and set the selectedPlace
        this.chooseListItem = function(place){
            self.toggleShowDrawer();
            //Check if marker exists (wouldn't be the case when google API failed to load)
            if(place.marker){
                google.maps.event.trigger(place.marker, 'click');
            } else{
                self.setSelectedPlace(place);
                self.showLargeInfoWindow(true);
            }
        };

        //Add location from our form to the places collection
        this.addLocation = function(){
            var name = self.newPlace.name();
            var latlng = {lat: map.getCenter().lat(),lng: map.getCenter().lng()};
            var info = self.newPlace.info();
            // Get a key for a new Place.
            var newPostKey = self.placesRef.push().key;
            var id = newPostKey;
            var draggable = true;
            var addedPlace = self.createPlace(name, info, id, latlng);
            this.placesRef.child(newPostKey).update(addedPlace.export(), function handleError(err){
                if(err){
                    console.log("error: " + err);
                }
            });
            addedPlace.setDraggable();
            self.toggleCreatingPlace();
            self.places.push(addedPlace);
            google.maps.event.trigger(addedPlace.marker, 'click');
            //Set up a new place for the next location creation.
            self.newPlace.name(""); 
            self.newPlace.info("");
            self.newPlace.id = self.places().length;
        };

        //Set the selectedPlace to the passed in place
        this.setSelectedPlace = function(place){
            if(!place) {
                // We deleted the last selected place
                console.log("saaa");
                this.selectedPlace(place);
                return true;
            } else if (!this.selectedPlace()){
                // This is the initial selection of the session.
                this.selectedPlace(place);
                this.selectedPlace().selected(true);
                return true;
            } else if(this.selectedPlace() === place){
                // The place is already selected
                return true;
            } else if(this.selectedPlace().editing() || this.selectedPlace().draggable()){
                // You can only change the selected place if you're not editing or dragging a place. 
                alert("Please save or cancel the changes you've made to the currently selected place before selecting another.");
                return false;
            } 
            //Set selected property of last selectedPlace to false;
            this.selectedPlace().selected(false);
            this.selectedPlace(place);
            //Set selected property of selectedPlace to true;
            this.selectedPlace().selected(true);
            return true;
        };

        //Remove place and associated marker from collection
        this.removeLocation = function(place){
            place.placeRef.remove(function handleError(err){
                if(err){
                    console.log("error: " + err);
                } 
            });
            place.marker.setVisible(false);
            infoWindow.close();
            infoWindow.marker = null;
            self.places.remove(place);
            self.setSelectedPlace(null);
        };

        //Populate the infowindow with the correct marker information
        this.populateInfowindow = function(marker){
            if(infoWindow.marker != marker){
                infoWindow.marker = marker;
                var contentHTML = "<div class='info-window' id='infoWindow'" + 
                    " data-bind='with: $root.selectedPlace()'>" + 
                    "<label class='info-window__name' data-bind='text: name'></label>" +
                    "<p data-bind='visible: draggable()'>" + 
                    "Drag and drop me in the correct location, then press 'Save Location'</p>" + 
                    "<button data-bind='click: $parent.toggleShowLargeInfoWindow," +
                    " visible: !draggable()'>Show all info</button>" +
                    "<button data-bind='click: setDraggable," + 
                    "visible: (!draggable())'>Move to new location</button>" +
                    "<button data-bind='visible: draggable(), click: updateLocation' >" + 
                    "Save location</button>" + 
                    "<button data-bind='visible: draggable(), click: toPreviousLocation' >" + 
                    "Reset location</button>" + 
                    "<button data-bind='click: $parent.removeLocation," + 
                    " visible: (!draggable())'>Remove spot</button>" +
                    "</div>";
                infoWindow.setContent(contentHTML);
                infoWindow.open(map, marker);
                var query = marker.getPosition().lat() + "," + marker.getPosition().lng();

                //We need to apply the bindings for this new infowindow (because it didn't exist at the time of applying bindings to the ViewModel)
                ko.applyBindings(self, document.getElementById('infoWindow'));
                infoWindow.addListener('closeclick', function setMarkerToNull(){
                    infoWindow.marker = null;
                });
            }
        };

        this.closeInfoWindow = function(){
            if(self.googleDefined){
                infoWindow.close();
            }
            return true;
        };
    };

    //Return true if browser supports the File API
    ViewModel.prototype.supportFileAPI = function(){
        if (window.File && window.FileReader && window.FileList && window.Blob) {
            return true;
        } else {
            return false;
        }
    };

    //Handle imported location JSON file
    ViewModel.prototype.handleJSONSelect = function(data, evt) {
        var self = this;
        var file = evt.target.files[0]; // FileList object

        var reader = new FileReader();

        // set firebase data to new JSON file when reader finished loading the JSON file
        reader.onload = function(event) {
            var data = event.target.result;
            var jsonData = JSON.parse(data);

            self.placesRef.set(jsonData.places, function handleError(err){
                if(err){
                    console.log("error: " + err);
                } else {
                    console.log(jsonData);
                }
            });
            //reload the current document
            location.reload();
        };

        // Read in the image file as a data URL.
        reader.readAsText(file);
    };

    //Handle image selecting
    ViewModel.prototype.handleImageSelect = function(data, evt) {
        var self = this;
        var preview = document.getElementById('previewImg');
        this.selectedFile = evt.target.files[0]; // save the selected file in your ViewModel
        this.resizedImage = null;
        //check if selected file extension is allowed
        var ext = this.selectedFile.name.match(/\.([^\.]+)$/)[1];
        switch(ext.toLowerCase()) {
            case 'jpg':
            case 'jpeg':
            case 'png':
            case 'bmp':
                break;
            default:
                alert('The file with extension ' + ext + " is not allowed.\n" +
                        "Please try again with a jpg, jpeg, png or bmp file.");
                this.resetUploadVariables();
                return;
        }

        //preview images, show upload button, and start resizing image for upload
        var reader = new FileReader();
        reader.onload = function(event) {
            preview.src = event.target.result;
            document.getElementById('images-upload-btn').classList.remove("hidden");
            document.getElementById('image-caption').classList.remove("hidden");
            //reset resized image if still present from last time
            if(self.resizedImage){
                self.resizedImage = null;
            }
            // start processing image in background (worker?)
            imageResizer.resizeImage(event.target.result, function(result){self.resizedImage = result;});
            // if they click upload image before finished (processedImage = false), then it should wait
        };
        // Read in the image file as a data URL.
        reader.readAsDataURL(this.selectedFile);
    };

    ViewModel.prototype.resetUploadVariables = function(){
        this.resizedImage = null;
        this.selectedFile = null;
        document.getElementById('previewImg').src = "";
        document.getElementById('image-caption').value = "";
    };

    //upload selected images to firebase
    ViewModel.prototype.uploadImage = function() {
        var self = this;
        document.getElementById('images-upload-btn').classList.add("hidden");
        document.getElementById('image-caption').classList.add("hidden");
        //if(this.resizedImage === null ){
            //console.log("Image is still resizing, will try again in 1 sec");
            //setTimeout(this.uploadImage, 1000);
            //return;
        //}
        var caption = document.getElementById('image-caption').value;

        //local reference of selectedPlace, to make sure all async functions have access to it.
        var selectedPlace = this.selectedPlace;
        var selectedPlaceKey = this.selectedPlace().placeRef.key;
        var imageStorageRef = this.storageRef.child('/images/' + selectedPlaceKey + "/" +
                this.selectedFile.name);
        var uploadTask = imageStorageRef.put(this.resizedImage);
        // Register three observers:
        // 1. 'state_changed' observer, called any time the state changes
        // 2. Error observer, called on failure
        // 3. Completion observer, called on successful completion
        uploadTask.on('state_changed', showUploadProgress, handleError, 
        uploadMetaData(selectedPlaceKey, self.selectedFile.name, caption));

        function showUploadProgress(snapshot){
            // Observe state change events such as progress, pause, and resume
            // Get task progress, including the number of bytes uploaded and the total number of bytes to be uploaded
            var progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            console.log('Upload is ' + progress + '% done');
            switch (snapshot.state) {
                case firebase.storage.TaskState.PAUSED: // or 'paused'
                    console.log('Upload is paused');
                    break;
                case firebase.storage.TaskState.RUNNING: // or 'running'
                    console.log('Upload is running');
                    break;
            }
        }

        function handleError(error) {
            // Handle unsuccessful uploads
            console.log("There occured an error while uploading the file to the server :" + error);
            self.resetUploadVariables();
        }

        function uploadMetaData(selectedPlaceKey, imageName, caption) {
            // Closure to ensure that placeKey and imageName are still relevant after image has uploaded
            return function(){
                // Handle successful uploads on complete
                // Upload image meta data to firebase
                var downloadURL = uploadTask.snapshot.downloadURL;
                var imageKey = self.imagesRef.child(selectedPlaceKey).push().key;
                var updates = {};
                var imageData = {
                    'url': downloadURL,
                    'caption': caption,
                    'name': imageName,
                    'key': imageKey
                    //'user': user.uid
                };
                self.imagesRef.child(selectedPlaceKey).child(imageKey).update(imageData);
                // Add imagedata to place instance
                selectedPlace().images.push(new Image(imageData.url, imageData.caption, imageData.name, imageKey));
                self.resetUploadVariables();
            }
        }
    };

    ViewModel.prototype.exportLocations = function() {
        var self = this;
        var exportPlaces = {
            places: {}
        };
        self.places().map(function(place){
            exportPlaces.places[place.export().id] = place.export();
        });

        console.save(ko.toJSON(exportPlaces), 'sessions');
    };

    //Initialize all places and markers 
    ViewModel.prototype.init = function() {
        var self = this;
        self.places = ko.observableArray([]);
        self.googleDefined = false;

        if(typeof google !== 'undefined'){
            self.googleDefined = true;
        }

        firebase.auth().onAuthStateChanged(function(loggedInUser) {
            if(loggedInUser){
                // Set the global user variable to the logged in user
                user = loggedInUser;
                document.getElementById('auth-modal').className += " hidden";
                
                self.databaseRef = firebase.database().ref();
                self.userRef = self.databaseRef.child('users').child(user.uid);
                self.placesRef = self.databaseRef.child('userObjects').child('places').child(user.uid);
                self.imagesRef = self.databaseRef.child('userObjects').child('images').child(user.uid);
                self.storageRef = firebase.storage().ref().child(user.uid);
                self.placesRef.once('value', function(snap){
                    snap.forEach(function(childSnapshot){
                        var place = childSnapshot.val();
                        var placeKey = childSnapshot.key;
                        var currentPlace = self.createPlace(place.name, place.info, placeKey, place.latlng);
                        self.places.push(currentPlace);
                        // Add image metadata to place instance
                        self.imagesRef.child(placeKey)
                        .once('value', (function(currentPlace){
                            return function(imagesSnap){
                                imagesSnap.forEach(function(imageSnap){
                                    var imageObj = imageSnap.val();
                                    currentPlace.images.push(new Image(imageObj.url, imageObj.caption, imageObj.name, imageObj.key));
                                });
                            };
                        })(currentPlace));
                    });
                });
                self.placesRef.on('child_removed', function(snap){
                    var placeKey = snap.key;
                    self.imagesRef.child(placeKey)
                    .once('value').then(removePlaceImages);
                });
            } else {
              // User not logged out, so show authorization modal. 
              document.getElementById('auth-modal').classList.remove('hidden');
              self.userRef = null;
              return;
            }
        });

        function removePlaceImages(snap){
            var placeKey = snap.key;
            snap.forEach(removeSingleImage.bind({placeKey: placeKey}));
        };

        function removeSingleImage(snap){
            //remove actual images from storage
            self.storageRef.child('images/' + this.placeKey + "/" + snap.val().name).delete()
            .then(removeMetaData(snap))
            .catch(handleStorageRemovalError);
        };

        function removeMetaData(snap){
            // if success
            // remove images metadata in database
            snap.ref.remove(handleMetaDataRemovalError);
        };

        function handleMetaDataRemovalError(err){
            if(err){
                console.log("Error when removing image metadata " + err);
            }
        };

        function handleStorageRemovalError(err){
            console.log("Error when removing image from cloud storage :" + err);
        };

        //Variable to hold the temporary new place during the creation process
        if(self.googleDefined){
            self.newPlace = self.createPlace("", "", self.places().length);
            self.newPlace.visible(false);
        }

        //Source: I created this computed observable after getting some ideas from Tamas Krasser
        self.filterPlaces = ko.computed(function() {
            var filter = self.filterValue().toLowerCase();

            self.places().forEach(function(place) {
                if (place.name().toLowerCase().indexOf(filter) > -1) {
                    place.visible(true);
                } else {
                    place.visible(false);
                }
            });
        });

        self.selectedPlace = ko.observable(self.places()[0]);

        ko.applyBindings(vm);

    };

    function initViewModel(){
        // check local storage for places 
        //var places = ko.utils.parseJson(localStorage.getItem('session-places'));
        vm = new ViewModel();
        vm.init();
    }

    //Init viewmodel without google maps (if the API Fails to load)
    methods.initWithoutMap = function(){
        initViewModel();
        document.getElementById('map').innerHTML = "<p>It seems like we couldn\'t load the google maps API, you can still browse around the spots and read and the place information, but you won't be able to add any new places</p>";
    };

    //Init viewmodel with google maps
    methods.initMap = function(){
        //show world with center on New Zealand
        var mapOptions = {
            zoom: 5, 
            center: {
                lat: -40.900557,
                lng : 174.885971
            },
            mapTypeControl: true,
            mapTypeControlOptions: {
                style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
                position: google.maps.ControlPosition.TOP_CENTER
            },
            zoomControl: true,
            zoomControlOptions: {
                position: google.maps.ControlPosition.RIGHT_CENTER
            },
            scaleControl: true,
            streetViewControl: true,
            streetViewControlOptions: {
                position: google.maps.ControlPosition.RIGHT_CENTER
            },
        };
        map = new google.maps.Map(document.getElementById('map'), mapOptions);
        infoWindow = new google.maps.InfoWindow();

        initViewModel();
    };
    
    return methods;
})();

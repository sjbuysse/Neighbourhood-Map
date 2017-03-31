/*jshint esversion: 6 */
var module = (function(){
    //global variables for the google map, google infowindow, and viewmodel instance
    var map;
    var infoWindow;
    var vm;

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
        //only create markers if the google API is working.
        if(typeof google){
            this.marker = this.createMarker();
        }
        this.placeRef = firebase.database().ref().child('places').child(this.id);
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

    //Method to set the place in edit mode
    Place.prototype.setEditing = function(){
        var self = this;
        this.editing(true);
        this.previousName = this.name();
        this.previousInfo = this.info();
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
    };

    Place.prototype.saveEditing = function(){
        var self = this;
        this.editing(false);
        this.placeRef.set(self.export(), function(err){
            if(err){
                console.log("error: " + err);
            }
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
    Place.prototype.export = function(){
        return {
            name: this.name(),
            info: this.info(),
            id: this.id,
            latlng: this.latlng(),
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
            if(!self.selectedPlace().draggable()) {
                self.showDrawer(!self.showDrawer());
                if(self.showDrawer){
                    self.creatingPlace(false);
                }
            } else {
                alert("Please drag and save the green pin before doing something else.");
            }
        };
        this.toggleCreatingPlace = function(){
            if(self.googleDefined && !self.selectedPlace().draggable()){
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
            var newPostKey = firebase.database().ref().push().key;
            var id = newPostKey;
            var draggable = true;
            var addedPlace = self.createPlace(name, info, id, latlng);
            this.placesRef.child(newPostKey).update(addedPlace.export(), function(err){
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
            if(this.selectedPlace() === place){
                return true;
            }
            //You can only change the selected place if you're not editing or dragging a place. 
            else if(this.selectedPlace().editing() || this.selectedPlace().draggable()){
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
            place.placeRef.remove(function(err){
                if(err){
                    console.log("error: " + err);
                }
            });
            place.marker.setVisible(false);
            infoWindow.close();
            infoWindow.marker = null;
            self.places.remove(place);
            self.setSelectedPlace(self.places()[0]);
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
                infoWindow.addListener('closeclick', function(){
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

            self.databaseRef.set(jsonData, function(err){
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
                //reset selected and resized image 
                this.selectedFile = null;
                this.resizedImage = null;
                return;
        }

        //preview images, show upload button, and start resizing image for upload
        var reader = new FileReader();
        reader.onload = function(event) {
            preview.src = event.target.result;
            document.getElementById('images-upload-btn').classList.remove("hidden");
            //reset resized image 
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

    //upload selected images to firebase
    ViewModel.prototype.uploadImage = function() {
        document.getElementById('images-upload-btn').classList.add("hidden");
        //if(this.resizedImage === null ){
            //console.log("Image is still resizing, will try again in 1 sec");
            //setTimeout(this.uploadImage, 1000);
            //return;
        //}
        var imageStorageRef = this.storageRef.child('/images/' + this.selectedFile.name);
        var uploadTask = imageStorageRef.put(this.resizedImage);
        // Register three observers:
        // 1. 'state_changed' observer, called any time the state changes
        // 2. Error observer, called on failure
        // 3. Completion observer, called on successful completion
        uploadTask.on('state_changed', function(snapshot){
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
        }, function(error) {
            // Handle unsuccessful uploads
        }, function() {
            // Handle successful uploads on complete
            // For instance, get the download URL: https://firebasestorage.googleapis.com/...
            var downloadURL = uploadTask.snapshot.downloadURL;
            console.log(downloadURL);
        });
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
        // Collection of places, create a new Place object with observable properties for each of these places. 
        this.databaseRef = firebase.database().ref();
        this.placesRef = this.databaseRef.child('places');
        this.storageRef = firebase.storage().ref();
        this.placesRef.once('value', function(snap){
            self.places = ko.observableArray([]);
            snap.forEach(function(childSnapshot){
                var place = childSnapshot.val();
                var newPlace = self.createPlace(place.name, place.info, childSnapshot.key, place.latlng);
                self.places.push(newPlace);
            });

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

            self.googleDefined = false;

            if(typeof google !== 'undefined'){
                self.googleDefined = true;
            }

            //Variable to hold the temporary new place during the creation process
            if(self.googleDefined){
                self.newPlace = self.createPlace("", "", self.places().length);
                self.newPlace.visible(false);
            }

            ko.applyBindings(vm);
        });
    };

    function initViewModel(){
        // check local storage for places 
        //var places = ko.utils.parseJson(localStorage.getItem('session-places'));
        vm = new ViewModel();
        vm.init();
    }

    //return places from the ViewModel (mostly for debugging reasons)
    methods.getPlaces  = function(){
        return vm.places();
    };

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

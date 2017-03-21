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
        this.sessions = ko.observableArray([]);
        //only create markers if the google API is working.
        if(typeof google){
            this.marker = this.createMarker();
        }
    };

    //Model for sessions
    var Session = function(info = ""){
        this.info = ko.observable(info);
        this.images = ko.observableArray([]);
    };

    Place.prototype.createSession = function(){
        var session = new Session();
        this.sessions.push(session);
        this.setEditing();
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
        // copy session info by value 
        this.previousSessionInfo = [];
        this.sessions().forEach(function(session){
            self.previousSessionInfo.push(session.info());
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
        this.sessions().forEach(function(session, index){
            //return the info to its previous value
            session.info(self.previousSessionInfo[index]);
            //remove session if it's empty
            if (session.info().trim().length == 0){
                self.sessions.remove(session);
            }
        });
    };

    Place.prototype.saveEditing = function(){
        var self = this;
        this.editing(false);
        //remove session if it's empty
        this.sessions().forEach(function(session) {
            if (session.info().trim().length == 0){
                self.sessions.remove(session);
            }
        });
    };

    Place.prototype.updateLocation = function(){
        this.draggable(false);
        var newLocation = {
            lat: this.marker.getPosition().lat(),
            lng: this.marker.getPosition().lng()
        };
        this.latlng(newLocation);
    };


    Place.prototype.toPreviousLocation = function() {
        this.draggable(false);
        this.latlng(this.previousLatLng);
    };

    //This is the information we'd like to export, so that we exclude the marker property
    //If you add something here, make sure you adjust the createPlace function for importing the localStorage data correctly
    Place.prototype.export = function(){
        var sessions = [];
        this.sessions().forEach(function(session) {
            var exportSession = {
                info: session.info
            };
            sessions.push(exportSession);
        });
        return {
            name: this.name,
            info: this.info,
            id: this.id,
            latlng: this.latlng,
            sessions: sessions
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

        this.createPlace = function(name, info, id, latlng = {lat: map.getCenter().lat(),lng: map.getCenter().lng()}, sessions = [], draggable = false) {
            var place = new Place(name, info, id, latlng, draggable);
            sessions.forEach(function(session) {
                var session = new Session(session.info);
                place.sessions.push(session);
            })
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
            var id = self.newPlace.id;
            var draggable = true;
            var addedPlace = self.createPlace(name, info, id, latlng);
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
    ViewModel.prototype.handleFileSelect = function(data, evt) {
        var self = this;
        var file = evt.target.files[0]; // FileList object

        // Loop through the FileList and render image files as thumbnails.

        var reader = new FileReader();

        // callback for when reader finished loading the file
        reader.onload = function(event) {
            localStorage.removeItem('session-places');
            var data = event.target.result;
            localStorage.setItem('session-places', data);
            //reload the current document
            location.reload();
        };

        // Read in the image file as a data URL.
        reader.readAsText(file);
    };

    ViewModel.prototype.exportLocations = function() {
        var self = this;
        console.save(ko.toJSON(self.exportPlaces()), 'sessions');
    };

    //Initialize all places and markers 
    ViewModel.prototype.init = function(places) {
        var self = this;
        // Collection of places, create a new Place object with observable properties for each of these places. 
        this.places = ko.observableArray(places.map(function(place){
            var newPlace = self.createPlace(place.name, place.info, place.id, place.latlng, place.sessions);
            return newPlace;
        }));

        //Source: I created this computed observable after getting some ideas from Tamas Krasser
        this.filterPlaces = ko.computed(function() {
            var filter = self.filterValue().toLowerCase();

            self.places().forEach(function(place) {
                if (place.name().toLowerCase().indexOf(filter) > -1) {
                    place.visible(true);
                } else {
                    place.visible(false);
                }
            });
        });

        this.selectedPlace = ko.observable(this.places()[0]);

        this.googleDefined = false;

        if(typeof google !== 'undefined'){
            this.googleDefined = true;
        }

        //Variable to hold the temporary new place during the creation process
        if(this.googleDefined){
            this.newPlace = self.createPlace("", "", self.places().length);
            this.newPlace.visible(false);
        }

    };

    //exportData is a computed array that we'll store the data in that we'd like to save to the localStorage. This array has to be a computed (or observable) so that when it updates, it will let the computed variable that sets the localStorage item gets fired
    //syncDataLocalStorage accepts as a parameter a collection with elements that have an export function that returns the JSON that we want to save in LocalStorage
    var syncDataLocalStorage = function(data) {
        this.exportData = ko.computed(function(){
            return data.map(function(element){
                return element.export();
            });
        });
        //
        // internal computed observable that fires whenever anything changes in our places
        // Source: todo-mvc (www.todo-mvc.com)
        ko.computed(function () {
            // store a clean copy to local storage, which also creates a dependency on
            // the observableArray and all observables in each item
            localStorage.setItem('session-places', ko.toJSON(this.exportData));
        }.bind(this)).extend({
            rateLimit: { timeout: 500, method: 'notifyWhenChangesStop' }
        }); // save at most twice per second
    }

    function initViewModel(){
        // check local storage for places 
        var places = ko.utils.parseJson(localStorage.getItem('session-places'));
        var placesFromServer = ko.utils.parseJson(placeList);
        vm = new ViewModel();
        vm.init(places || placeList);
        ko.applyBindings(vm);
        syncDataLocalStorage(vm.places());
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

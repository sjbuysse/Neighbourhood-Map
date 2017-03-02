/*jshint esversion: 6 */
var module = (function(){
    //global variables for the google map, google infowindow, and viewmodel instance
    var map;
    var infoWindow;
    var vm;

    //Object that holds the methods that we need to access from outside this module
    var methods = {};

    //Model for places
    var Place = function(name, info, id, latlng, forecastJSON, forecastHTML, draggable){
        this.name = ko.observable(name);
        this.latlng = ko.observable(latlng);
        this.info = ko.observable(info);
        this.forecastJSON = ko.observable(forecastJSON);
        this.forecastHTML = ko.observable(forecastHTML);
        this.id = id;
        this.editing = ko.observable(false);
        this.draggable = ko.observable(draggable);
        this.visible = ko.observable(true);
        this.selected = ko.observable(false);
    };

    //I don't add the markers as a property of the place instance because it's easier to export the places to JSON this way (you can't export a marker instance), and I can still use the application without googlemaps
    //
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
        marker.addListener('click', function(){
            if(vm.setSelectedPlace(self)) {
                vm.populateInfowindow(marker);
            }
        });
        return marker;
    };

    //Method to set the place in edit mode
    Place.prototype.setEditing = function(){
        this.editing(true);
        this.previousName = this.name();
        this.previousInfo = this.info();
    };

    Place.prototype.setDraggable = function() {
        this.draggable(true);
        this.previousLatLng = this.latlng();
    };

    Place.prototype.undoEditing = function(){
        this.editing(false);
        this.name(this.previousName);
        this.info(this.previousInfo);
    };

    Place.prototype.removeForecast = function() {
        this.forecastJSON(false);
        this.forecastHTML(false);
    };

    Place.prototype.saveEditing = function(){
        this.editing(false);
    };

    Place.prototype.updateLocation = function(){
        var self = this;
        this.draggable(false);
        var marker = vm.findMarker(self);
        var newLocation = {
            lat: marker.getPosition().lat(),
            lng: marker.getPosition().lng()
        };
        this.latlng(newLocation);
    };


    Place.prototype.toPreviousLocation = function() {
        this.draggable(false);
        this.latlng(this.previousLatLng);
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

        this.createPlace = function(name, info, id, latlng = {lat: map.getCenter().lat(),lng: map.getCenter().lng()}, forecastJSON = false, forecastHTML = false, draggable = false) {
            var place = new Place(name, info, id, latlng, forecastJSON, forecastHTML, draggable);
            ko.computed(function(){
                var visible = self.filterValue().trim().length > 0 ? self.partOfFilter(place) : true;
                place.visible(visible);
            });
            return place;
        };

        //When we click on a list item, we want to open up the infowindow and set the selectedPlace
        this.chooseListItem = function(place){
            self.toggleShowDrawer();
            //Check if markers observableArray exists (wouldn't be the case when google API failed to load)
            if(self.markers){
                google.maps.event.trigger(self.findMarker(place), 'click');
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
            self.markers().push(addedPlace.createMarker());
            google.maps.event.trigger(self.markers()[self.markers().length-1], 'click');
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
            var marker = self.findMarker(place);
            marker.setVisible(false);
            infoWindow.close();
            infoWindow.marker = null;
            self.markers.remove(marker);
            self.places.remove(place);
            self.setSelectedPlace(self.places()[0]);
        };

        //Populate the infowindow with the correct marker information
        this.populateInfowindow = function(marker){
            if(infoWindow.marker != marker){
                infoWindow.marker = marker;
                infoWindow.open(map, marker);
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

        this.requestForecast = function(place){
            var  _PremiumApiKey = "582f4a8e36294b81b54221346172602";
            var  _PremiumApiBaseURL = "http://api.worldweatheronline.com/premium/v1/";
            var input = {
                query : place.latlng().lat + "," + place.latlng().lng,
                format : "json",
                interval: 6
            };

            JSONP_MarineWeather(input);
            function JSONP_MarineWeather(input) {
                var url = _PremiumApiBaseURL + "marine.ashx?q=" + input.query + "&tp=" +input.interval + "&format=" + input.format +  "&key=" + _PremiumApiKey;
                jsonP(url, input.callback);
            }

            // Helper Method
            function jsonP(url) {
                //Fallback error message that shows itself if the ajax request hasn't been successful after 5seconds.
                var wikiRequestTimeout = setTimeout(function(){
                    alert("Failed to get forecast data, make sure you're connected to the internet or that your firewall doesn't prevent you from accessing the worldweatheronline servers");
                }, 5000);
                $.ajax({
                    type: 'GET',
                    url: url,
                    async: false,
                    contentType: "application/json",
                    dataType: 'jsonp',
                    success: function (json) {
                        //Add today's forecast to the place instance 
                        place.forecastJSON(json.data.weather[0]);
                        place.forecastHTML(self.createForecastElement(json.data.weather[0]));
                        clearTimeout(wikiRequestTimeout);
                    }
                });
            }
        };

        //Create HTML table for the forecast 
        this.createForecastElement = function(data) {
            function createRow(headerName, property){
                var row = "<tr><th scope='row'>" + headerName + "</th>";
                data.hourly.forEach(function(forecast){
                    row += "<td>" + forecast[property] + "</td>";
                });
                row += "</tr>";
                return row;
            }
            var date = data.date;
            var element = "<thead><tr>" + 
                "<th scope='row'>" + date + "</th>" + 
                "<th scope='col'>6AM</th>" + 
                "<th scope='col'>12AM</th>" + 
                "<th scope='col'>6PM</th>" + 
                "<th scope='col'>12PM</th>" + 
                "</tr></thead>";
            //Add row with swell info
            element += createRow("Swell (m):", "swellHeight_m");
            //Add row with Significant wave height
            element += createRow("Wave Heigth (m):", "sigHeight_m");
            //Add row with Swell direction
            element += createRow("Swell direction:", "swellDir16Point");
            //Add row with Swell period
            element += createRow("Period (s):", "swellPeriod_secs");
            //Add row with Wind direction
            element += createRow("Wind direction:", "swellDir16Point");
            //Add row with Wind speed
            element += createRow("Wind speed (kmph):", "windspeedKmph");
            //add footer row with attribution
            element += "<tfoot><tr><td colspan='5'>Source: www.worldweatheronline.com</td></tr></tfoot>";
                return element;
        };


        this.exportLocations = function() {
            console.save(localStorage['session-places'], 'sessions');
        };

        //Helper method to check if the filter value is part of the passed in place's name
        this.partOfFilter = function(place){
            return place.name().toLowerCase().indexOf(self.filterValue().toLowerCase()) === -1 ? false : true;
        };

        // Helper method to get the marker that belongs to the passed in place
        this.findMarker = function(place) {
            var index = self.markers().findIndex(function(marker){
                return marker.id === place.id;
            });
            return self.markers()[index];
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
            location.reload();
        };

        // Read in the image file as a data URL.
        reader.readAsText(file);
    };

    //Initialize all places and markers 
    ViewModel.prototype.init = function(places) {
        var self = this;
        // Collection of places, create a new Place object with observable properties for each of these places. 
        this.places = ko.observableArray(places.map(function(place){
            var newPlace = self.createPlace(place.name, place.info, place.id, place.latlng, place.forecastJSON, place.forecastHTML);
            return newPlace;
        }));

        this.selectedPlace = ko.observable(this.places()[0]);

        //Variable to hold the temporary new place during the creation process
        this.newPlace = self.createPlace("", "", self.places().length);

        this.googleDefined = false;

        if(typeof google !== 'undefined'){
            this.markers = ko.observableArray(this.places().map(function(place){
                return place.createMarker();
            }));
            this.googleDefined = true;
            this.selectedMarker = ko.computed(function(){
                return self.findMarker(self.selectedPlace);
            });
        }
        //
        // internal computed observable that fires whenever anything changes in our places
        // Source: todo-mvc (www.todo-mvc.com)
        ko.computed(function () {
            // store a clean copy to local storage, which also creates a dependency on
            // the observableArray and all observables in each item
            localStorage.setItem('session-places', ko.toJSON(this.places));
        }.bind(this)).extend({
            rateLimit: { timeout: 500, method: 'notifyWhenChangesStop' }
        }); // save at most twice per second
    };

    function initViewModel(){
        // check local storage for places 
        var places = ko.utils.parseJson(localStorage.getItem('session-places'));
        var placesFromServer = ko.utils.parseJson(placeList);
        vm = new ViewModel();
        vm.init(places || placeList);
        ko.applyBindings(vm);
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

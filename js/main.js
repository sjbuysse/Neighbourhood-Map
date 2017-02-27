var map; 
var infoWindow;

//Model for places
var Place = function(name, latlng, info, id){
    this.name = ko.observable(name);
    this.latlng = ko.observable(latlng);
    this.info = ko.observable(info);
    this.id = id;
    this.editing = ko.observable(false);
    this.visible = ko.observable(true);
};

var ViewModel = function(){
    var self = this;

    //Observables to toggle classes to open and close these parts of the UI
    this.showDrawer = ko.observable(false);
    this.showLargeInfoWindow = ko.observable(false);
    this.creatingPlace = ko.observable(false);

    this.toggleShowDrawer = function(){
        self.showDrawer(!self.showDrawer());
        if(self.showDrawer){
            self.creatingPlace(false);
        }
    };

    this.toggleCreatingPlace = function(){
        if(self.googleDefined){
            self.creatingPlace(!self.creatingPlace());
            if(self.creatingPlace){
                self.showDrawer(false);
            }
        }
    };

    this.toggleShowLargeInfoWindow = function(){
        self.showLargeInfoWindow(!self.showLargeInfoWindow());
    };

    //Current value in the searchBox
    this.filterValue = ko.observable('');

    this.createPlace = function(name, info, id, latlng = {lat: "0",lng: "0"}){
        var place = new Place(name, latlng, info, id);
        ko.computed(function(){
            var visible = self.filterValue().trim().length > 0 ? self.partOfFilter(place) : true;
            place.visible(visible);
        });
        return place;
    }

    //This checks if the filter value is part of the passed in place's name
    this.partOfFilter = function(place){
        return place.name().toLowerCase().indexOf(self.filterValue().toLowerCase()) === -1 ? false : true;
    }

    this.chooseListItem = function(place){
        self.toggleShowDrawer();
        //Check if markers observableArray exists (wouldn't be the case when google API failed to load)
        if(self.markers){
            var index = self.markers().findIndex(function(marker){
                return marker.id === place.id;
            });
            google.maps.event.trigger(self.markers()[index], 'click');
        } else{
            self.setSelectedPlace(place);
            self.showLargeInfoWindow(true);
        }
    }

    this.addLocation = function(){
        var name = self.newPlace.name();
        var latlng = self.newPlace.latlng();
        var info = self.newPlace.info();
        var id = self.newPlace.id;
        var addedPlace = self.createPlace(name, info, id, latlng);
        self.places.push(addedPlace);
        self.markers().push(self.createMarker(addedPlace));
        self.toggleCreatingPlace();
        google.maps.event.trigger(self.markers()[self.markers().length-1], 'click');
        self.setSelectedPlace(addedPlace);
        //Set up a new place for the next location creation.
        self.newPlace.name(""); self.newPlace.latlng({lat: map.getCenter().lat(),lng: map.getCenter().lng()});
        self.newPlace.info("");
        self.newPlace.id = self.places().length;
        //self.newPlace = self.createPlace("", {lat: map.getCenter().lat(),lng: map.getCenter().lng()}, "", self.places().length);
    };

    this.createMarker = function(place) {
        var marker = new google.maps.Marker({
            position: place.latlng(),
            title: place.name(),
            id: place.id,
            map: map,
            draggable: true, 
            animation: google.maps.Animation.DROP
        });
        ko.computed(function(){
            marker.setVisible(place.visible());
        });
        marker.addListener('click', function(){
            self.setSelectedPlace(place);
            self.populateInfowindow(marker);
        });
        marker.addListener('dragend', function(){self.updateLocation(marker, place);});
        return marker;
    };

    this.setSelectedPlace = function(place){
        this.selectedPlace(place);
    };

    this.removeLocation = function(place){
        var i = self.markers().findIndex(function(marker){
            return marker.id == place.id;
        });
        self.markers()[i].setVisible(false);
        infoWindow.close();
        infoWindow.marker = null;
        self.markers.splice(i);
        self.places.remove(place);
    };

    this.populateInfowindow = function(marker){
        if(infoWindow.marker != marker){
          infoWindow.marker = marker;
          infoWindow.open(map, marker);
          var contentHTML = "<div id='infoWindow' data-bind='with: $root.selectedPlace()'>" + 
              "<label class='info-window__name' data-bind='text: name, visible: !editing(), " + 
              "event: { dblclick: $root.setEditing }'></label>" +
              "<input class='info-window__name--edit' data-bind='value: name, " + 
              "valueUpdate: &quot;afterkeydown&quot;, " + 
              "visible: editing, enterKey: $root.saveEditing, escapeKey: $root.undoEditing'></input>" +
              "lat: " + "<span data-bind='text: latlng().lat'></span>" +
              "lng: " + "<span data-bind='text: latlng().lng'></span>" +
              "<button data-bind='click: $parent.toggleShowLargeInfoWindow'>Show all info</button>" +
              "<button data-bind='click: $parent.removeLocation, visible: !editing()'>Remove spot</button>" +
              "<button data-bind='click: $parent.saveEditing, visible: editing()'>Update spot</button>" +
              "</div>";
          infoWindow.setContent(contentHTML);
          var query = marker.getPosition().lat() + "," + marker.getPosition().lng();
          self.requestForecast(query);

          //We need to apply the bindings for this new infowindow (because it didn't exist at the time of applying bindings to the ViewModel)
          ko.applyBindings(self, document.getElementById('infoWindow'));
          infoWindow.addListener('closeclick', function(){
                  infoWindow.marker = null;
              });
        }
    };

    this.requestForecast = function(query){
          var  _PremiumApiKey = "582f4a8e36294b81b54221346172602";
          var  _PremiumApiBaseURL = "http://api.worldweatheronline.com/premium/v1/";
          var input = {
              query : query, 
              format : "json",
          }

          JSONP_MarineWeather(input);
            function JSONP_MarineWeather(input) {
                var url = _PremiumApiBaseURL + "marine.ashx?q=" + input.query + "&format=" + input.format +  "&key=" + _PremiumApiKey;
                jsonP(url, input.callback);
            }

            // Helper Method
            function jsonP(url) {
                $.ajax({
                    type: 'GET',
                    url: url,
                    async: false,
                    contentType: "application/json",
                    dataType: 'jsonp',
                    success: function (json) {
                        console.dir(json);
                    },
                    error: function (e) {
                        console.log(e.message);
                    }
                });
            }
    }

    this.saveEditing = function(place){
        place.editing(false);
    };

    this.undoEditing = function(place){
        place.editing(false);
        place.name(place.previousName);
        place.info(place.previousInfo);
    };

    this.updatePlace = function(place){
        var newLocation = {
            lat: marker.getPosition().lat(),
            lng: marker.getPosition().lng()
        };
        place.latlng(newLocation);
    };

    this.updateLocation = function(marker, place){
        var newLocation = {
            lat: marker.getPosition().lat(),
            lng: marker.getPosition().lng()
        };
        place.latlng(newLocation);
    };

    this.setEditing = function(place){
        place.editing(true);
        place.previousName = place.name();
        place.previousInfo = place.info();
    };

    this.exportLocations = function() {
        console.save(localStorage['session-places'], 'sessions');
    };

};

ViewModel.prototype.init = function(places) {
    var self = this;
    // Collection of places, create a new Place object with observable properties for each of these places. 
    this.places = ko.observableArray(places.map(function(place){
        var place = self.createPlace(place.name, place.info, place.id, place.latlng);
        return place;
    }));

    this.selectedPlace = ko.observable(this.places()[0]);

    //Variable to hold the temporary new place during the creation process
    this.newPlace = self.createPlace("", "", self.places().length);

    this.googleDefined = false;

    if(typeof google !== 'undefined'){
        this.markers = ko.observableArray(this.places().map(function(place){
            return self.createMarker(place);
        }));
        this.googleDefined = true;
    }
    //
		// internal computed observable that fires whenever anything changes in our places
    // plagiarism: got this from todo-mvc
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
    var vm = new ViewModel();
    vm.init(places || placeList);
    ko.applyBindings(vm);
}

function initWithoutMap(){
    console.log("kaas");
    initViewModel();
    document.getElementById('map').innerHTML = "<p>It seems like we couldn\'t load the google maps API, you can still browse around the spots and read and the place information, but you won't be able to add any new places</p>";
}

function initMap(){
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
}



// Make an observable array of markers , and add a filter function to the viewmodel that sets the map `null` for any marker that doesn't fit the filter. 
// Geocode the data first time and save in localstorage, then from then on use localstorage

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

var ViewModel = function(places){
    var self = this;

    //Observables to toggle classes to open and close these parts of the UI
    this.showDrawer = ko.observable(false);
    this.showLargeInfoWindow = ko.observable(false);
    this.creatingPlace = ko.observable(false);

    this.toggleShowDrawer = function(){
        self.showDrawer(!self.showDrawer());
    };

    this.toggleCreatingPlace = function(){
        self.creatingPlace(!self.creatingPlace());
    };

    this.toggleShowLargeInfoWindow = function(){
        self.showLargeInfoWindow(!self.showLargeInfoWindow());
    };

    //Current value in the searchBox
    this.filterValue = ko.observable();

    this.createPlace = function(name, latlng, info, id){
        var place = new Place(name, latlng, info, id);
        //ko.computed(function(){

        //});
        return place;
    }

    this.addLocation = function(){
        var name = self.newPlace.name();
        var latlng = self.newPlace.latlng();
        var info = self.newPlace.info();
        var id = self.newPlace.id;
        var addedPlace = self.createPlace(name, latlng, info, id);
        self.places.push(addedPlace);
        self.markers().push(self.createMarker(addedPlace));
        self.setSelectedPlace(addedPlace);
        //Set up a new place for the next location creation.
        self.newPlace.name(""); self.newPlace.latlng({lat: map.getCenter().lat(),lng: map.getCenter().lng()});
        self.newPlace.info("");
        self.newPlace.id = self.places().length;
        //self.newPlace = self.createPlace("", {lat: map.getCenter().lat(),lng: map.getCenter().lng()}, "", self.places().length);
        self.toggleCreatingPlace();
        self.toggleShowDrawer();
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
              "<button id='showLargeInfo'>Show all info</button>" +
              "<button data-bind='click: $parent.removeLocation, visible: !editing()'>Remove spot</button>" +
              "<button data-bind='click: $parent.saveEditing, visible: editing()'>Update spot</button>" +
              "</div>";
          infoWindow.setContent(contentHTML);
          //We need to apply the bindings for this new infowindow (because it didn't exist at the time of applying bindings to the ViewModel)
          ko.applyBindings(self, document.getElementById('infoWindow'));
          infoWindow.addListener('closeclick', function(){
                  infoWindow.marker = null;
              });
        }
    };

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

    // Collection of places, create a new Place object with observable properties for each of these places. 
    this.places = ko.observableArray(places.map(function(place){
        var place = self.createPlace(place.name, place.latlng, place.info, place.id);
        return place;
    }));

    this.selectedPlace = ko.observable(this.places()[0]);

    //Variable to hold the temporary new place during the creation process
    this.newPlace = self.createPlace("", {lat: map.getCenter().lat(),lng: map.getCenter().lng()}, "", self.places().length);

    this.markers = ko.observableArray(this.places().map(function(place){
        return self.createMarker(place);
    }));

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

    // check local storage for places 
    var places = ko.utils.parseJson(localStorage.getItem('session-places'));
    var placesFromServer = ko.utils.parseJson(placeList);
    ko.applyBindings(new ViewModel(places || placeList));
}


// Make an observable array of markers , and add a filter function to the viewmodel that sets the map `null` for any marker that doesn't fit the filter. 
// Geocode the data first time and save in localstorage, then from then on use localstorage

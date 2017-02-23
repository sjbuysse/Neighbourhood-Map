var map; 
var infoWindow;

//Model for places
var Place = function(name, latlng, info, id){
    this.name = ko.observable(name);
    this.latlng = ko.observable(latlng);
    this.info = ko.observable(info);
    this.id = id;
    this.editing = ko.observable(false);
};

var ViewModel = function(places){
    var self = this;

    this.createLocation = function(){
        var location = {
            lat: map.getCenter().lat(),
            lng: map.getCenter().lng()
        };
        var place = new Place("kaas", location, "some information about this spot", this.places().length);
        this.places.push(place);
        this.markers().push(this.createMarker(place));
        
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
              "<label class='info-window__title' data-bind='text: name, visible: !editing(), " + 
              "event: { dblclick: $root.setEditing }'></label>" +
              "<input class='info-window__title--edit' data-bind='value: name, " + 
              "valueUpdate: &quot;afterkeydown&quot;, " + 
              "visible: editing, enterKey: $root.saveEditing, escapeKey: $root.undoEditing'>" +
              "lat: " + "<span data-bind='text: latlng().lat'></span>" +
              "lng: " + "<span data-bind='text: latlng().lng'></span>" +
              "<button>Show all info</button>" +
              "<button data-bind='click: $parent.removeLocation, visible: !editing()'>Remove spot</button>" +
              "<button data-bind='click: $parent.saveEditing, visible: editing()'>Update spot</button>" +
              "</div>";
          infoWindow.setContent(contentHTML);
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
        return new Place(place.name, place.latlng, place.info, place.id);
    }));

    this.selectedPlace = ko.observable(this.places()[0]);

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

// Data array of JSon objects representing places
var placeList = [{
        name: 'Piha',
        country: 'New Zealand',
        region: 'Auckland', 
    },{
        name: 'Robin hood Bay',
        country: 'New Zealand',
        region: 'Marlborough'
    },{
        name: 'Shingles Beach',
        country: 'New Zealand',
        region: 'West Coast'
    },{
        name: 'New Brighton',
        country: 'New Zealand',
        region: 'Canterburry'
    },{
        name: 'St Clair',
        country: 'New Zealand',
        region: 'Otago'
    },{
        name: 'Karitane bar',
        country: 'New Zealand',
        region: 'Otago'
    },{
        name: 'Tomahawk',
        country: 'New Zealand',
        region: 'Otago'
    },{
        name: 'Brighton',
        country: 'New Zealand',
        region: 'Otago'
    },{
        name: 'Blackhead',
        country: 'New Zealand',
        region: 'Otago'
    },{
        name: 'Campbells Bay',
        country: 'New Zealand',
        region: 'Otago'
    },{
        name: 'All Day Bay',
        country: 'New Zealand',
        region: 'Otago'
    },{
        name: 'Shag Beach',
        country: 'New Zealand',
        region: 'Otago'
    },{
        name: 'Katiki Point',
        country: 'New Zealand',
        region: 'Otago'
    },{
        name: 'Aramoana Spit',
        country: 'New Zealand',
        region: 'Otago'
    },{
        name: 'Warrington',
        country: 'New Zealand',
        region: 'Otago'
    },{
        name: 'Aramoana Spit',
        country: 'New Zealand',
        region: 'Otago'
    },{
        name: 'Moeraki',
        country: 'New Zealand',
        region: 'Otago'
    }
];

var map; 
var infoWindow;

//Model for places
var Place = function(name, latlng, info, id){
    this.name = ko.observable(name);
    this.latlng = ko.observable(latlng);
    this.info = ko.observable(info);
    this.id = id;
};

var ViewModel = function(places){
    var self = this;

    this.createLocation = function(){
        var location = {
            lat: map.getCenter().lat(),
            lng: map.getCenter().lng()
        }
        var place = new Place("kaas", location, "some information about this spot", this.places().length);
        this.places.push(place);
        this.markers().push(this.createMarker(place));
        
    };

    this.createMarker = function(place) {
        var marker = new google.maps.Marker({
            position: place.latlng(),
            map: map,
            draggable: true, 
            animation: google.maps.Animation.DROP,
            title: place.name()
        });
        marker.addListener('click', function(){
            self.setSelectedPlace(place);
            self.populateInfowindow(marker);
        });
        marker.addListener('dragend', function(){self.updateLocation(marker, place)});
        return marker;
    };

    this.setSelectedPlace = function(place){
        this.selectedPlace(place);
    }

    this.populateInfowindow = function(marker){
        if(infoWindow.marker != marker){
          infoWindow.marker = marker;
          infoWindow.open(map, marker);
          var contentHTML = "<div id='infoWindow'>" + 
              "<h2 data-bind='text: $root.selectedPlace().name'></h2>"+
              "lat: " + "<span data-bind='text: $root.selectedPlace().latlng().lat'></span>"+
              "lng: " + "<span data-bind='text: $root.selectedPlace().latlng().lng'></span>"+
              "</div>";
          infoWindow.setContent(contentHTML);
          ko.applyBindings(self, document.getElementById('infoWindow'));
          infoWindow.addListener('closeclick', function(){
                  infoWindow.marker = null;
              });
        }
    };

    this.updateLocation = function(marker, place){
        var newLocation = {
            lat: marker.getPosition().lat(),
            lng: marker.getPosition().lng()
        }
        place.latlng(newLocation);
    };

    // Collection of places, create a new Place object with observable properties for each of these places. 
    this.places = ko.observableArray(places.map(function(place){
        return new Place(place.name, place.latlng, place.info, place.id);
    }));

    this.selectedPlace = ko.observable(this.places()[0]);

    this.markers = ko.observableArray(this.places().map(function(place){
        self.createMarker(place);
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
    //show world with center on Belgium
    var mapOptions = {
        zoom: 2, 
        center: {lat: 51.5051449, lng: 6.408124099999999}
    };
    map = new google.maps.Map(document.getElementById('map'), mapOptions);
    infoWindow = new google.maps.InfoWindow();

    // check local storage for places 
    var places = ko.utils.parseJson(localStorage.getItem('session-places'));
    ko.applyBindings(new ViewModel(places || []));
};


// Make an observable array of markers , and add a filter function to the viewmodel that sets the map `null` for any marker that doesn't fit the filter. 
// Geocode the data first time and save in localstorage, then from then on use localstorage

var $drawer = $('#drawer');
var $largeInfoWindow = $('#large-info-window');
var $map = $('#map');

$largeInfoWindow.on('click', '#large-info-window__toggle', function(){
    $largeInfoWindow.toggleClass('large-info-window--open');
});

var $menuToggleBtn = $('#drawer__toggle');
$menuToggleBtn.click(function(){
    $drawer.toggleClass('drawer--open');
});

var $createLocationBtn = $('#create-location');
$createLocationBtn.click(function(){
    $largeInfoWindow.addClass('large-info-window--open');
    $drawer.removeClass('drawer--open');
});


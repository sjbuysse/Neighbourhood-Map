var $largeInfoWindowToggle = $('#large-info-window__toggle');
$largeInfoWindowToggle.click(function(){
    $(this).parent().toggleClass('large-info-window--open');
});

var $menuToggle = $('#drawer__toggle');
$menuToggle.click(function(){
    $(this).parent().toggleClass('drawer--open');
});

(function($) {
  $.fn.setHeight = function() {
        var $element = this;
        var heightOfParent = $element.parent().height(),
        offset = $element.offset(),
        topOfList = offset.top,
        potentialHeight = heightOfParent - topOfList;

        $element.css('height',potentialHeight);
  }
})(jQuery);

$(document).ready(
    function() {
        $('#filter-list').setHeight();
    }
);

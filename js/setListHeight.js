(function($) {
  $.fn.getPotentialHeight = function() {
        var $element = this;
        var heightOfParent = $element.parent().height();
        offset = $element.offset();
        topOfElement = offset.top;
        return (heightOfParent - topOfElement);
  }
})(jQuery);

$(document).ready(
    function() {
        var potentialHeight = $('#filter-list').getPotentialHeight();
        $('#filter-list').css('height', potentialHeight);
    }
);

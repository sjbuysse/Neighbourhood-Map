//Source: http://stackoverflow.com/questions/3837037/div-with-scrollbar-inside-div-with-positionfixed
(function($) {
  $.fn.getPotentialHeight = function() {
        var $element = this;
        //heightOfParent is the height of parents content (inside the padding)
        var heightOfParent = $element.parent().height();
        var offset = $element.position();
        var topOfElement = offset.top;
        // potential height of element including the elements margin
        var phInclMargin = heightOfParent - topOfElement;
        // potential height of element excluding the elements margin
        var phExclMargin = phInclMargin - parseInt($element.css('margin-top')) - parseInt($element.css('margin-bottom'));
        return phExclMargin;
  };
})(jQuery);

$(document).ready(
    function() {
        $filterList = $('#filter-list');
        var phFilterList = $filterList.getPotentialHeight();
        console.log(phFilterList);
        $filterList.css('height', phFilterList);

        $infoWrapper = $('#info-wrapper');
        var phInfoWrapper = $infoWrapper.getPotentialHeight();
        console.log(phInfoWrapper);
        $infoWrapper.css('height', phInfoWrapper);
    }
);

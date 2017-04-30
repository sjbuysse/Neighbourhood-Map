window.addEventListener("resize", function() {
    console.log("buggs");
        $filterList = $('#filter-list');
        var phFilterList = $filterList.getPotentialHeight();
        console.log("phFilterList " + phFilterList);

        $infoWrapper = $('#info-wrapper');
        var phInfoWrapper = $infoWrapper.getPotentialHeight();
        console.log("phInfoWrapper " + phInfoWrapper);
  if(document.activeElement.tagName=="INPUT" || document.activeElement.tagName=="TEXTAREA") {
      console.log("bugggy");
     window.setTimeout(function() {
        document.activeElement.scrollIntoViewIfNeeded();
     },0);
  }
});

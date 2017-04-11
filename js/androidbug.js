window.addEventListener("resize", function() {
  if(document.activeElement.tagName=="INPUT" || document.activeElement.tagName=="TEXTAREA") {
      console.log("bugggy");
     window.setTimeout(function() {
        document.activeElement.scrollIntoViewIfNeeded();
     },0);
  }
})

/*jshint esversion: 6 */
var imageResizer = ( function(){
    var methods = {};
    //resizeImage accepts an imageblob as input optional 'result' variable to save the resized image to.
    methods.resizeImage = function(data, callback, maxWidth = 1000, maxHeight = 1000){
         var img = document.createElement("img");
         var delay = 10; // add this delay of 10ms in between actions to free up the call stack and give the UI a chance to get something done. (Would be better to use web workers in stead, but the support is too little for now and web workers can't access the DOM (so can't use a canvas))

         img.onload = function(){
             var width = img.width;
             var height = img.height;

             if (width > height) {
                 if (width > maxWidth) {
                   height *= maxWidth / width;
                   width = maxWidth;
                 }
             } else {
                 if (height > maxHeight) {
                     width *= maxHeight / height;
                     height = maxHeight;
                 }
             }

             //Add a canvas, and draw image on it with right dimensions, then export the image
             var canvas = document.createElement('canvas');
             canvas.width = width;
             canvas.height = height;
             var ctx = canvas.getContext("2d");

             setTimeout(function(){
                drawImageIOSFix(ctx, img, 0, 0, img.naturalWidth, img.naturalHeight, 0, 0, width, height);
             }, delay); // gives the UI a chance to get something done.

             setTimeout(function(){
                 canvas.toBlob(function(blob){
                     callback(blob);
                 }, "image/png");
             }, delay); // gives the UI a chance to get something done.
         };

         img.src = data;
    };

    /**
     * Detecting vertical squash in loaded image.
     * Fixes a bug which squash image vertically while drawing into canvas for some bigger (+2MB?) images.
     * This is a bug in iOS6 devices. This function from https://github.com/stomita/ios-imagefile-megapixel
     * 
     */
    function detectVerticalSquash(img) {
        var iw = img.naturalWidth, ih = img.naturalHeight;
        var canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = ih;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        var data = ctx.getImageData(0, 0, 1, ih).data;
        // search image edge pixel position in case it is squashed vertically.
        var sy = 0;
        var ey = ih;
        var py = ih;
        while (py > sy) {
            var alpha = data[(py - 1) * 4 + 3];
            if (alpha === 0) {
                ey = py;
            } else {
                sy = py;
            }
            py = (ey + sy) >> 1;
        }
        var ratio = (py / ih);
        return (ratio===0)?1:ratio;
    }

    /**
     * A replacement for context.drawImage
     * (args are for source and destination).
     */
    function drawImageIOSFix(ctx, img, sx, sy, sw, sh, dx, dy, dw, dh) {
        var vertSquashRatio = detectVerticalSquash(img);
        console.log("Vertical Squash Ration: " + vertSquashRatio);
     // Works only if whole image is displayed:
        ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh / vertSquashRatio);
     // The following works correct also when only a part of the image is displayed:
        //ctx.drawImage(img, sx * vertSquashRatio, sy * vertSquashRatio, 
                           //sw * vertSquashRatio, sh * vertSquashRatio, 
                           //dx, dy, dw, dh );
    }
    return methods;
})();

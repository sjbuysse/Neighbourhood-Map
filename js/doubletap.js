// Create custom event binding for listening to double taps on mobile devices
ko.bindingHandlers.doubleTap = {
    init: function(element, valueAccessor, allBindingsAccessor, data, bindingContext){
        var tappedTwice = false;
        var wrappedHandler, newValueAccessor;

        // wrap the handler with a check for the enter key
        wrappedHandler = function (data, event) {
            if (!tappedTwice) {
                tappedTwice = true;
                setTimeout( function() { tappedTwice = false;  }, 300  );
                return false;
            }
            valueAccessor().call(this, data, event);
        };
        // create a valueAccessor with the options that we would want to pass to the event binding
        newValueAccessor = function () {
            return {
                click: wrappedHandler
            };
        };

        // call the real event binding's init function
        ko.bindingHandlers.event.init(element, newValueAccessor, allBindingsAccessor, data, bindingContext);
    }
}

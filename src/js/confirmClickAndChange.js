// custom event binding to to confirm the click before exectuting a callback funtion

ko.bindingHandlers.confirmClick = {
    init: function(element, valueAccessor, allBindings, viewModel) {
        var value = valueAccessor();
        var message = ko.unwrap(value.message);
        var click = value.click;
        ko.applyBindingsToNode(element, { click: function () {
            if (confirm(message))
                // call the callback function you've defined in the data-bind (value.click)
                return click.apply(this, Array.prototype.slice.apply(arguments));
        }}, viewModel);
    }
};

// custom event binding to to confirm the change before exectuting a callback funtion
//
ko.bindingHandlers.confirmChange = {
    init: function(element, valueAccessor, allBindings, viewModel) {
        var value = valueAccessor();
        var message = ko.unwrap(value.message);
        var change = value.change;
        ko.applyBindingsToNode(element, { event: {change: function () {
            if (confirm(message))
                // call the callback function you've defined in the data-bind (value.click)
                return change.apply(this, Array.prototype.slice.apply(arguments));
        }}}, viewModel);
    }
};

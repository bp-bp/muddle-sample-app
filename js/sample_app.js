angular.module("mud_app", ["muddle"]);

angular.module("mud_app").service("current", [function() {
	var _current_entity = null;
	var _current_ents_by_type = {}; // not using?
	var _current_type = null;
	var _current_master = null;
	
	// getters/setters
	this.entity = function(ent) {
		if (ent) {
			_current_entity = ent;
		}
		return _current_entity;
	};
	
	this.type = function(type) {
		if (type) {
			_current_type = type;
		}
		return _current_type;
	};
	
	this.master = function(master) {
		if (master) {
			_current_master = master;
		}
		return _current_master;
	};
}]);
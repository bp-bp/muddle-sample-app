function sample_menu_ctrl(data_muddle, muddle_backend, current) {
	var self = this;
	self.dm = data_muddle;
	self.backend = muddle_backend;
	self.current = current;
	
	// testing/troubleshooting
	self.log_current = function() {
		console.log("current entity: ", self.current.entity());
		console.log("current type: ", self.current.type());
		console.log("current master: ", self.current.master());
	};
	
	// switch from one master-level dataset to another
	self.change_master = function(master, old_master) {
		var go = true, param_master = master || null;
		
		// check with user before loading a new master dataset if there are 
		// unsaved changes in the current one
		if (self.dm.modified_ents().length) {
			go = confirm("There are unsaved changes in the current company, if you load a new company these changes will be lost.\n\nLoad anyway?");
		}
		
		if (!go) {
			// this is odd... the interpolated old_master passed in via the ng-change directive like {{current_master()}} is an "Object"
			// rather than an "Entity" and looks like a copy. angular is fun!
			self.current.master(self.dm.get_master(old_master.id));
			return;
		}
		
		// good to go, clear current data and load new master dataset
		self.dm.init_keep_masters();
		self.backend.load_master(param_master).then(
			// success
			function() {
				if (self.dm.ents.length) {
					self.current.type(Object.keys(self.dm.ents_by_type)[0]);
					self.current.entity(self.dm.ents_by_type[self.current.type()][0]);
				}
			},
		);
	};
	
	// create a new blank master-level dataset. check with the user first if there are unsaved changes in the current one
	self.new_blank_master = function() {
		var go = true;
		if (self.dm.modified_ents().length) {
			go = confirm("There are unsaved changes in the current company, if you create a new company these changes will be lost.\n\nCreate anyway?");
		}
		
		if (go) {
			var master = self.dm.new_blank_master();
			self.dm.init_keep_masters();
			self.current.master(master);
			return master;
		}
	};
}
angular.module("mud_app").controller("sample_menu_ctrl", ["data_muddle", "muddle_backend", "current", sample_menu_ctrl]);
angular.module("mud_app").component("sampleMenu", {
	bindings: {}
	, controller: ["data_muddle", "muddle_backend", "current", sample_menu_ctrl]
	, controllerAs: "s_menu"
	, templateUrl: "templates/sample_menu.html"
});
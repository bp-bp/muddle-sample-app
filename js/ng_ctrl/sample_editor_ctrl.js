function sample_editor_ctrl(data_muddle, muddle_backend, current) {
	var self = this;
	self.dm = data_muddle;
	self.backend = muddle_backend;
	self.current = current;
	
	// load everything
	self.$onInit = function() {
		self.dm.init_fresh_page();
		self.backend.load_all_masters().then(
			// success
			function(payload) {
				self.current.master(self.dm.masters[0]);
				return self.backend.load_master(self.current.master());
			}
		).then(
			// success
			function(payload) {
				if (self.dm.ents.length) {
					self.current.type(Object.keys(self.dm.ents_by_type)[0]);
					self.current.entity(self.dm.ents_by_type[self.current.type()][0]);
				}
				console.log(self.dm);
			}
		);
	};
	
	self.delete_entity = function(entity) {
		var go, confirm_str, affected_ents = self.dm.find_ent_in_ents(entity), ent_name = entity.get_child("name").val();
		
		// first handle any references to the entity to be deleted, if there are any
		if (affected_ents.length > 0) {
			var i, ent_str = "", name_array = [], clear_list;
			// build a string listing of the names of the affected entities to warn the user before 
			// clearing and deleting
			for (i = 0; i < affected_ents.length; i++) {
				name_array.push(affected_ents[i].get_child("name").val());
			}

			ent_str = name_array.join(", ");
			confirm_str = "The entity " + ent_name + " is referenced in the following other entities: \n\n" + ent_str + ".";
			confirm_str += "\n\nConfirm you want to delete this entity?";
		}
		else {
			confirm_str = "Confirm you want to delete " + ent_name + "?";
		}
		
		// get the user's response
		go = confirm(confirm_str);
		
		// stop everything if the user says no
		if (!go) {
			return;
		}
		
		// now clear out all references to this entity, keeping a list of which ents were affected
		clear_list = self.dm.clear_ent_from_ents(entity);
		// now actually delete the entity from the front-end...
		self.dm.delete_ent(entity);
		
		// and now save the affected ents and finally do the delete on the backend
		// if clear_list is empty this will just do nothing
		self.backend.save(clear_list, self.current.master()).then(
			// success
			function(payload) {
				console.log("save before delete successful.");
				return self.backend.delete(entity);
			},
			// fail
			function(payload) {
				console.log("save before delete failed...");
			}
		).then(
			// success
			function(payload) {
				// could do something here if you want... don't have to. Don't really have to have this second .then()
			},
			// fail
			function(payload) {
				// see above
			}
		);
	};
}
angular.module("mud_app").controller("sample_editor_ctrl", ["data_muddle", "muddle_backend", "current", sample_editor_ctrl]);
angular.module("mud_app").component("sampleEdit", {
	bindings: {}
	, controller: ["data_muddle", "muddle_backend", "current", sample_editor_ctrl]
	, controllerAs: "s_edit"
	, templateUrl: "templates/sample_edit.html"
});
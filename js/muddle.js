angular.module("muddle", []);

angular.module("muddle").service("data_muddle", [function() {
	// this is the core service
	
	var data_srv = this;
	
	// where we keep all the actual data
	this.masters = [];
	this.ents = [];
	this.ents_by_type = {};
	this.types = [];
	var ents = this.ents;
	
	// some utilities
	// creates unique id... yes, on the front-end. jazz this up with a username or a timestamp if you don't trust it. 
	this.gen_id = function () {
		function chunk() {
			var id = Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
			return id;
		}

		return chunk() + chunk() + '-' + chunk() + '-' + chunk() + '-' + chunk() + '-' + chunk() + chunk() + chunk();
	};
	
	// comparison function used in fix_edit_sort
	this.edit_sort_compare = function(a, b) {
		return a.edit_sort - b.edit_sort;
	};
	
	// rejiggers the edit_sort property on all items in passed-in list, used here and there
	this.fix_edit_sort = function(list) {
		if (! list) {
			return;
		}
		
		var i;
		list.sort(this.edit_sort_compare);
		for (i = 0; i < list.length; i++) {
			list[i].edit_sort = i + 1;
		}
	};
	
	// called when loading data from backend
	this.unpack_loaded_ents = function(nugs) {
		// loop through li'l datanuggets looking for top-level ents
		var i, nug, init_obj = {}, ents = [];
		for (i = 0; i < nugs.length; i++) {
			if (nugs[i].top_level) {
				init_obj.type = nugs[i].type;
				init_obj.master_level = nugs[i].master_level;
				init_obj.id = nugs[i].id;
				init_obj.edit_sort = nugs[i].edit_sort;
				init_obj.loaded = true;
				ents.push(this.make_entity(init_obj));
			}
		}
		
		// now loop through nuggets, recursively add content...
		for (i = 0; i < ents.length; i++) {
			this.fill_in_obj(ents[i], nugs);
		}
	};
	
	
	this.fill_in_obj = function(obj, nugs) {
		var i, nug, temp, val, init_obj, sub_nugs = [], children = [];
		
		// find all nugs that are children of current obj
		for (i = 0; i < nugs.length; i++) {
			if (nugs[i].parent_id == obj.id) {
				sub_nugs.push(nugs[i]);
			}
		}
		
		// loop through child nugs, adding to current obj
		for (i = 0; i < sub_nugs.length; i++) {
			temp = sub_nugs[i];
			val = null;
			init_obj = {};
			
			// add children of different types
			// first props
			if (temp.type === "prop") {
				// set up init_obj
				init_obj.type = temp.type
				init_obj.prop_name = temp.name;
				init_obj.prop_type = temp.prop_type;
				init_obj.parent = obj;
				init_obj.edit_only = temp.edit_only;
				init_obj.edit_sort = temp.edit_sort;
				init_obj.bound_id = temp.bound_id;
				init_obj.is_file = temp.is_file;
				init_obj.id = temp.id;
				// get correct _val
				if (temp.str_val) {
					val = temp.str_val;
				}
				else if (temp.num_val) {
					val = temp.num_val;
				}
				else if (temp.bool_val) {
					val = temp.bool_val;
				}
				init_obj.prop_val = val;
				
				// create prop
				obj.add_child(init_obj);
			}
			// then prop_conts
			else if (temp.type === "prop_cont") {
				init_obj.type = temp.type;
				init_obj.prop_cont_name = temp.name;
				init_obj.parent = obj;
				init_obj.id = temp.id;
				init_obj.edit_sort = temp.edit_sort;
				init_obj.bound_id = temp.bound_id;
				
				// create prop_cont
				obj.add_child(init_obj);
			}
			// and list_props
			else if (temp.type === "list_prop") {
				init_obj.id = temp.id;
				init_obj.type = temp.type;
				init_obj.list_prop_name = temp.name;
				init_obj.parent = obj;
				init_obj.bound_list_type = temp.bound_list_type;
				init_obj.edit_sort = temp.edit_sort
				
				// create list_prop
				obj.add_child(init_obj);
			}
		}
		
		// now loop through obj.children(), filling in as we go
		if (obj.type != "prop") {
			children = obj.children()
			for (i = 0; i < children.length; i++) {
				this.fill_in_obj(children[i], nugs);
			}
			
			// hacky bit to fix _enum value... other option would be to save/load this, doesn't feel necessary, but it can't
			// be set at init time since we need to know the number of children.
			if (obj.type === "list_prop") {
				if (obj.bound_list_type == null) {
					obj._enum = children.length - 1;
				}
			}
		}
	};
	
	// flips edit_sort property to move an ent up or down in a list (assuming list is sorted
	// by edit_sort property). 
	this.ent_up = function(ent, list) {
		var i, switch_ent; 
		var target_idx = ent.edit_sort - 1; 

		// if we're already at the top
		if (ent.edit_sort == 1) {
			return;
		}

		for (i = 0; i < list.length; i++) {
			if (list[i].edit_sort == target_idx) {
				switch_ent = list[i];
			}
		}

		switch_ent.edit_sort = ent.edit_sort;
		ent.edit_sort = target_idx;
		
		// if we've got a top-level ent we need to set both it's AND the switch_ent's 
		// modified indicators to true
		// if we've got some kind of prop, we just set true_parent().modified = true
		if (ent.top_level) {
			switch_ent.modified = true;
			ent.modified = true;
		}
		else {
			ent.true_parent().modified = true;
		}
	};
	
	this.ent_down = function(ent, list) {
		var i, switch_ent; 
		var target_idx = ent.edit_sort + 1; 

		// if we're already at the bottom
		if (ent.edit_sort == list.length) {
			return;
		}

		for (i = 0; i < list.length; i++) {
			if (list[i].edit_sort === target_idx) {
				switch_ent = list[i];
			}
		}

		switch_ent.edit_sort = ent.edit_sort;
		ent.edit_sort = target_idx;
		
		// if we've got a top-level ent we need to set both it's AND the switch_ent's 
		// modified indicators to true
		// if we've got some kind of prop, we just set true_parent().modified = true
		if (ent.top_level) {
			switch_ent.modified = true;
			ent.modified = true;
		}
		else {
			ent.true_parent().modified = true;
		}
	};
	
	// ***************************************//
	// begin data types
	// ***************************************//
	// data will be stored as a hierarchy of the following types of objects, nested under Entity objects.
	// Entity is the top level. Entities can contain props, prop-conts, and list-props. 
	// a prop simply contains either a value or a reference to another entity, accessible via its .val() method
	// a prop-cont contains other objects, either props, list-props, or other prop-conts
	// a list-prop is a kind of special case of a prop-cont, it's a list of prop-conts that all have the same structure
	// list-props are explained in more detail below, with their definition
	
	// base top-level entity
	this.Entity = function(obj) {
		this.type = obj.type;
		this.top_level = true;
		this.modified = true;
		this.bound_id = null;
		
		// plain array of all children
		this._children = [];
		// dict of children -- keys are names, values are the indices to the child in the plain array
		this._children_idx = {};
		
		// handle loaded vs new
		if (angular.isDefined(obj.loaded)) {
			if (obj.loaded == true) {
				this.modified = false;
			}
		}
		
		// handle master level ents
		this.master_level = (obj.master_level == null) ? false : obj.master_level;
		
		// handle editor sort order
		if (angular.isDefined(obj.edit_sort)) {
			this.edit_sort = parseInt(obj.edit_sort);
		}
		else {
			this.edit_sort = 1;
		}
		
		// handle new vs loaded, gen permanent persistent id if new
		if (angular.isDefined(obj.id)) {
			this.is_new = false;
			this.id = obj.id;
		}
		else {
			this.is_new = true;
			this.id = data_srv.gen_id();
		}
		// am I using this anymore?
		var me = this;
		
		// generic handlers
		this.get_child = function(name) {
			// I think I need these checks... in the directives they will be looking for nulls, not undefineds
			if (angular.isDefined(this._children_idx[name])) {
				if (angular.isDefined(this._children[this._children_idx[name]])) {
					return this._children[this._children_idx[name]];
				}
				else {
					return null;
				}
			}
			else {
				return null;
			}
			
		};
		
		this.add_child = function(obj) {
			var child;
			if (obj.type === "prop") {
				child = new Prop(obj);
			}
			else if (obj.type === "prop_cont") {
				child = new Prop_Cont(obj);
			}
			else if (obj.type === "list_prop") {
				child = new List_Prop(obj);
			}
			else {
				console.log("Entity.add_child() got no good type specified");
			}
			
			this._children.push(child);
			this._children_idx[child.name] = this._children.length - 1;
			return child;
		};
		
		this.children = function() {
			return this._children;
		}; 
		
		// kicks off process of clearing all references to the passed-in ent from this ent's children
		// used when deleting something, don't want to leave dead refs
		this.clear_ent_from_self = function(ent) {
			var id = ent.id, me = this, q;
			if (this.children().length > 0) {
				q = this.hunt_ent_in_thing(id, me, true);
			}
			return q;
		};
		
		// returns self if contains ref to ent passed in param
		this.check_for_ent_in_self = function(ent) {
			var q = false, id = ent.id, me = this;
			if (this.children().length > 0) {
				q = this.hunt_ent_in_thing(id, me);
			}
			return q;
		};
		
		// for recursing above... if clear === true we'll be nulling the val of whatever we find
		this.hunt_ent_in_thing = function(id, thing, clear = false) {
			var i, cx, par, q = false;
			if (thing.type === "prop") {
				if (thing.prop_type === "ref") {
                    if (thing.val()) {
                        if (thing.val().id === id) {
							if (clear) {
								thing.val(null);
							}
                            return true;
                        }
                    }
				}
			}
			else {
				// delete prop_conts with bound_id == id -- a bound ent is being deleted
				if (clear) {
					if (thing.type === "prop_cont") {
						if (thing.bound_id === id) {
							par = thing.immed_parent();
							par.remove_child(thing.name);
							return true;
						}
					}
				}
				
				cx = thing.children();
				if (cx.length > 0) {
					for (i = 0; i < cx.length; i++) {
						q = q || this.hunt_ent_in_thing(id, cx[i], clear);
					}
				}
			}
			
			return q;
		};
		
		// returns a list of all props containing a file to upload
		this.fetch_files = function() {
			var files = this.file_hunt(this);
			return files;
		};
		
		this.file_hunt = function(thing) {
			var i, cx, sub_cx, files = [];
			cx = thing.children();
			
			for (i = 0; i < cx.length; i++) {
				// if we've got a prop, check if it contains a file and append to files list
				if (cx[i].type === "prop") {
					if (cx[i].val_is_file) {
						files.push({prop_id: cx[i].id, file: cx[i].val()});
					}
				}
				// if this is not an prop, check if it has children and keep hunting
				else {
					sub_cx = cx[i].children();
					if (sub_cx.length > 0) {
						files = files.concat(this.file_hunt(cx[i]));
					}
				}
			}
			
			return files;
		};
		
	};
	
	// simplest prop, contains one thing: either a value, a reference to an ent, or a file
	var Prop = function(obj) {
		
		// closures
		var init_obj = obj;
		// NO!
		var prop_data_srv = data_srv;
		
		// handle ids
		if (angular.isDefined(obj.id) && obj.id != null) {
			this.id = obj.id;
		}
		else {
			this.id = data_srv.gen_id();
		}
		
		this.type = "prop";
		this.master_level = false;
		this.top_level = false;
		
		// handle editor sort order
		if (angular.isDefined(obj.edit_sort)) {
			this.edit_sort = parseInt(obj.edit_sort);
		}
		else {
			this.edit_sort = 0;
		}
		
		// if this is an editor-only attribute
		this.edit_only = (obj.edit_only == null) ? false : obj.edit_only;
		
		// keep track of bound_id, and if we are in a bound_list -- for props I'm not currently passing this to obj
		this.bound_id = (obj.bound_id == null) ? null : obj.bound_id;
		
		// if this is a file type prop, whether or not there is currently a file stored in it
		this.is_file = (obj.is_file == null) ? false : obj.is_file;
		
		// if we've actually currently got a file in _val, we'll need to know this when saving
		// this only gets set from the assetFilepicker directive
		this.val_is_file = false;
		
		// 'val' or 'ref'
		this.prop_type = obj.prop_type;
		this.name = obj.prop_name;
		
		if (angular.isDefined(obj.prop_val)) {
			this._val = obj.prop_val;
		}
		else {
			this._val = null;
		}
		this.parent_id = obj.parent.id;
		
		// main getter/setter
		this.val = function(p_val) {
			if (angular.isDefined(p_val)) {
				this._val = p_val;
				// if this is an editor-only attribute
				if (! obj.edit_only) {
					this.true_parent().modified = true;
				}
			}
			
			// get
			// if this is a simple value attribute
			if (this.prop_type == "val") {
				return this._val;
			}
			// if this is a reference attribute
			else if (this.prop_type == "ref") {
				return prop_data_srv.get_ent(this._val);
			}
		};
		
		// hunts up the parent chain and returns top-level ancestor ent
		this.true_parent = function() {
			console.log("true_parent called");
			if (obj.parent.top_level) {
				return obj.parent;
			}
			else {
				var par = obj.parent;
				while (par.top_level == false) {
					par = par.immed_parent();
				}
				return par;
			}
		}
		
		this.immed_parent = function() {
			return obj.parent;
		}
		
		this.base_name = function() {
			if (angular.isDefined(obj.base_name)) {
				return obj.base_name;
			}
			return null;
		};
		
	};
	
	// container for other props, prop-conts, or list-props
	var Prop_Cont = function(obj) {
		// closures
		var prop_cont_data_srv = data_srv;
		// NO STOP IT
		var init_obj = obj;
		
		// handle ids
		if (angular.isDefined(obj.id) && obj.id != null) {
			this.id = obj.id;
		}
		else {
			this.id = data_srv.gen_id();
		}
		
		// handle editor sort order
		if (angular.isDefined(obj.edit_sort)) {
			this.edit_sort = parseInt(obj.edit_sort);
		}
		else {
			this.edit_sort = 0;
		}
		
		// keep track of bound_id, and if we are in a bound_list
		this.bound_id = (obj.bound_id == null) ? null : obj.bound_id;
		
		this.type = "prop_cont";
		this.master_level = false;
		this.top_level = false;
		this.parent_id = obj.parent.id;
		
		this.name = obj.prop_cont_name;
		// does this ever happen?
		if (angular.isDefined(obj.list)) {
			if (obj.list != null) {
				this._children = obj.list;
			}
		}
		else {
			this._children = [];
		}
		
		this._children_idx = {};
		
		// in case this is an item in a list_prop
		// p sure I'm not using this
		if (angular.isDefined(obj.idx)) {
			this.idx = obj.idx;
			this.bound_child_val = null;
			this.bound_child = null;
		}
		
		// generic handlers
		this.get_child = function(name) {
			// I think I need these checks -- in the directives they will be looking for nulls, not undefineds
			if (angular.isDefined(this._children_idx[name])) {
				if (angular.isDefined(this._children[this._children_idx[name]])) {
					return this._children[this._children_idx[name]];
				}
				else {
					return null;
				}
			}
			else {
				return null;
			}
			
		};
		
		this.add_child = function(obj) {
			var child;
			if (obj.type == "prop") {
				child = new Prop(obj);
			}
			else if (obj.type == "list_prop") {
				child = new List_Prop(obj);
			}
			else if (obj.type == "prop_cont") {
				child = new Prop_Cont(obj); // not sure I can do this bro
			}
			else {
				console.log("this.add_child() got no good type specified");
			}
			
			this._children.push(child);
			this._children_idx[child.name] = this._children.length - 1;
			return child;
		};
		
		// deletes self from parent if parent has remove_child method... list_props, basically
		this.remove_self = function() {
			var par = this.immed_parent();
			if (par.remove_child) {
				par.remove_child(this.name);
			}
		};
		
		this.true_parent = function() {
			if (init_obj.parent.top_level) {
				return init_obj.parent;
			}
			else {
				var par = init_obj.parent;
				while (par.top_level == false) {
					par = par.immed_parent();
				}
				return par;
			}
		};
		
		this.immed_parent = function() {
			return init_obj.parent;
		};
		
		this.base_name = function() {
			if (angular.isDefined(init_obj.base_name)) {
				return init_obj.base_name;
			}
			return null;
		};
		
		
		this.children = function() {
			return this._children;
		};
		
	};
	
	// kind of a special case of a prop-cont, a list of prop-conts of identical structure
	// used with ng-repeat and a prop-cont inside, with increment and delete buttons
	// an even more special case exists when a list-prop is bound to a list of all ents of a particular type 
	// in this case, there's no increment button or delete buttons, the length of the list is the same as the
	// number of ents of its bound type and each prop-cont inside is bound to the ent at its corresponding 
	// edit_sort position . A prop within each prop-cont should contain a reference to its corresponding ent.
	// See sample_app.html for examples of both cases.
	var List_Prop = function(obj) {
		//var list_prop = {};
		
		// closures
		var list_prop_data_srv = data_srv;
		// NO!!!
		var init_obj = obj;
		
		// handle ids
		if (angular.isDefined(obj.id) && obj.id != null) {
			this.id = obj.id;
		}
		else {
			this.id = data_srv.gen_id();
		}
		// various attributes
		this.type = "list_prop";
		this.master_level = false;
		this.top_level = false;
		this.bound_id = null; // what's this now?
		this.parent_id = obj.parent.id;
		
		// handle editor sort order
		if (angular.isDefined(obj.edit_sort)) {
			this.edit_sort = parseInt(obj.edit_sort);
		}
		else {
			this.edit_sort = 0;
		}
		
		// handle bound list
		this.bound_list_type = null;
		if (angular.isDefined(obj.bound_list_type)) {
			this.bound_list_type = obj.bound_list_type;
			obj.bound_list = list_prop_data_srv.ents_by_type[obj.bound_list_type];
		}
		
		this.name = obj.list_prop_name;
		// should this be initializable?
		this._children = [];
		this._children_idx = {};
		this._enum = -1;
		
		// child handlers
		this.add_child = function(obj) {
			var child;
			if (obj.type == "prop") {
				child = new Prop(obj);
			}
			else if (obj.type == "prop_cont") {
				child = new Prop_Cont(obj);
			}
			
			if (child.edit_sort == 0) {
				child.edit_sort = this._children.length + 1;
			}
			
			this._children.push(child);
			this._children_idx[child.name] = this._children.length - 1;
			return child;
		};
		
		this.remove_child = function(name) {
			var i, idx;
			if (angular.isDefined(this._children_idx[name])) {
				this._children.splice(this._children_idx[name], 1);
			}
			else {
				console.log("could not find child name to remove: " + name);
				return;
			}
			this._enum -= 1;
			
			// fix sort order and this._children_idx
			this._children_idx = {};
			this._children.sort(list_prop_data_srv.edit_sort_compare);
			for (i = 0; i < this._children.length; i++) {
				this._children[i].edit_sort = i + 1;
				this._children_idx[this._children[i].name] = i;
			}
			
			// set modified indicator on top level parent
			this.true_parent().modified = true;
		};
		
		this.fix_children_idx = function() {
			var i;
			this._children_idx = {};
			this._children.sort(list_prop_data_srv.edit_sort_compare);
			for (i = 0; i < this._children.length; i++) {
				this._children[i].edit_sort = i + 1;
				this._children_idx[this._children[i].name] = i;
			}
		};
		
		this.get_child = function(name) {
			// I think I need these checks -- in the directives they will be looking for nulls, not undefineds
			if (angular.isDefined(this._children_idx[name])) {
				if (angular.isDefined(this._children[this._children_idx[name]])) {
					return this._children[this._children_idx[name]];
				}
				else {
					return null;
				}
			}
			else {
				return null;
			}
		};
		
		// pass-through helpers
		this.true_parent = function() {
			if (obj.parent.top_level) {
				return obj.parent;
			}
			else {
				var par = obj.parent;
				while (par.top_level == false) {
					par = par.immed_parent();
				}
				return par;
			}
		};
		
		this.immed_parent = function() {
			return obj.parent;
		};
		
		this.bound_list = function() {
			return obj.bound_list;
		}
		
		// not used?
		this.count = function() {
			var i;
			var l = [];
			for (i = 0; i < this._count; i++) {
				l.push(i);
			}
			
			return l;
		};
		
		// return this via closure from enum_list to avoid infinite digest cycle
		var enum_objs = [];
		this._enum_objs = [];
		
		// sort prop_conts by associated bound ent's edit_sort property
		this.sort_by_bound_ent = function(x, y) {
			var i, x_id, y_id, b_x = {}, b_y = {}, b_list = obj.bound_list;
			x_id = x.id.substr(0, x.id.indexOf("_cont"));
			y_id = y.id.substr(0, y.id.indexOf("_cont"));

			for (i = 0; i < b_list.length; i++) {
				if (b_list[i].id == x_id) {
					b_x.edit_sort = b_list[i].edit_sort;
				}
				else if (b_list[i].id == y_id) {
					b_y.edit_sort = b_list[i].edit_sort;
				}
			}

			return b_x.edit_sort - b_y.edit_sort;
		};
		
		// returns list of objects containing id's and edit_sort values for the list_prop directive to create or find
		// its child prop_cont's
		this.enum_list = function() {
			if (this.bound_list_type == null) {
				return this.unbound_enum_list();
			}
			else {
				return this.bound_enum_list();
			}
		};
		
		//
		this.unbound_enum_list = function() {
			var edit_sort, ent_id, i, q = [], count_to = this._enum, bound_child = false, children = this.children();
			
			// create list_prop_obj for each child of list_prop. If we've just increment()'ed, we'll have 
			// a count_to one higher than the number of children, and we'll generate a new id for the to-be-created
			// prop_cont and send it back to the view, which will give it to the prop_cont directive which will
			// create the prop_cont with the id we generated here.
			for (i = 0; i <= count_to; i++) {
				edit_sort = null;
				// if this child existed already
				if (i < children.length) {
					ent_id = children[i].id;
					edit_sort = children[i].edit_sort;
				}
				// if this item doesn't exist
				else {
					ent_id = data_srv.gen_id();
				}
				
				q.push({idx: i, ent_id: ent_id, edit_sort: edit_sort, bound_child: bound_child});
			}
			
			// to avoid infinite digest cycle
			if (angular.equals(this._enum_objs, q)) {
				return this._enum_objs;
			}
			else {
				this._enum_objs = q;
				return this._enum_objs;
			}
		};
		
		// this whole bit right here is kinda difficult to follow
		this.bound_enum_list = function() {
			var edit_sort, ent_id, bound_child_id, cont_id;
			var q = [], remove_names = [], bound_child = true, bound_list = this.bound_list(), children = this.children();
			
			// make sure bound list is in proper edit_sort order
			bound_list.sort(list_prop_data_srv.edit_sort_compare);
			
			// clean up deleted bound ents from _children
			for (i = 0; i < children.length; i++) {
				bound_child_id = children[i].id.substr(0, 36);
				// now check if this id corresponds to an ent in the bound_list... if not, ent has been deleted
				// since this last ran, and we must prepare to remove the child prop_cont
				if (! this.id_in_bound_list(bound_child_id)) {
					remove_names.push(children[i].name);
				}
			}
			// actually remove deleted children
			for (i = 0; i < remove_names.length; i++) {
				this.remove_child(remove_names[i]);
			}
			// rejigger _children after removing items
			this.fix_children_idx();
			
			// temporarily sort children by their corresponding bound ent's edit_sort property
			// this way children will be in the same order as each child's corresponding bound ent
			// check if I need this? does fix_children_idx do the same thing?
			children.sort(this.sort_by_bound_ent);
			
			for (i = 0; i < bound_list.length; i++) {
				ent_id = bound_list[i].id + "_cont";
				edit_sort = bound_list[i].edit_sort;
				
				// set the ent_id for the return list
				// ent_id is ultimately bound ent's id + "_cont_" + child prop_cont's id
				if (i < children.length) {
					// cont_id is the portion of the long-ass id that belongs to the prop_cont itself
					cont_id = children[i].id.substr(children[i].id.indexOf("_cont") + 5);
					ent_id += cont_id;
				}
				// OK... if the list_prop is on a new ent, there are no children yet, or a new bound ent was created,
				// will need a new id and an prop_cont will get created by the directive controller with the below new id
				else {
					ent_id += ("_" + data_srv.gen_id());
				}
				q.push({idx: i, ent_id: ent_id, edit_sort: edit_sort, bound_child: bound_child});
			}
			
			// rejigger back to original sort order
			this.fix_children_idx();
			
			// to avoid infinite digest cycle
			if (angular.equals(this._enum_objs, q)) {
				return this._enum_objs;
			}
			else {
				this._enum_objs = q;
				return this._enum_objs;
			}
		};
		
		this.id_in_bound_list = function(id) {
			var i, list = this.bound_list();
			for (i = 0; i < list.length; i++) {
				if (list[i].id == id) {
					return true;
				}
			}
			return false;
		};
		
		this.children = function() {
			return this._children;
		};
		
		// add a blank item -- used only for unbound lists
		this.increment = function() {
			this._enum += 1;
		};	
	};
	
	// ***************************************//
	// end data types
	// ***************************************//
	
	this.modified_ents = function() {
		var i, q = [];
		for (i = 0; i < this.ents.length; i++) {
			if (this.ents[i].modified) {
				// dirty hack -- keep it out of modified_ents and it won't get saved with the other ents, needs to be saved
				// with its own call
				// I could instead have the server look for master-level items to be saved, pull them out and save
				// them first...
				// not sure I need this anymore, now saving master ents with the others
				//if (! this.ents[i].master_level) {
					q.push(this.ents[i]);
				//}
			}
		}
		
		// now look for new master-levels
		
		for (i = 0; i < this.masters.length; i++) {
			if (this.masters[i].modified) {
				q.push(this.masters[i]);
			}
		}
		
		return q;
	};
	
	
	this.add_type = function(type) {
		if (! angular.isDefined(this.ents_by_type[type])) {
			this.ents_by_type[type] = [];
		}
	}
	
	// completely clears all data
	this.init_fresh_page = function() {
		this.masters = [];
		this.ents = [];
		// types will already exist in ents_by_type as keys with empty arrays as values
		// created by ent directives
		for (type in this.ents_by_type) {
			this.ents_by_type[type] = [];
		}
	};
	
	// clears all data except for given type
	// don't think I'm using this anymore, but someone could I guess
	this.init_keep_type = function(type) {
		var i, new_ents = [];
		for (i = 0; i < this.ents.length; i++) {
			if (this.ents[i].type == type) {
				new_ents.push(this.ents[i]);
			}
		}
		
		this.ents = new_ents;
		
		for (t in this.ents_by_type) {
			if (t != type) {
				this.ents_by_type[t] = [];
			}
		}
	};
	
	// clears all data except for this.masters
	this.init_keep_masters = function() {
		this.ents = [];
		for (type in this.ents_by_type) {
			this.ents_by_type[type] = [];
		}
	};
	
	// used when clicking a "new" button, blank contents/values
	this.new_blank_entity = function(type) {
		// keep edit_sort values sorted out
		this.fix_edit_sort(this.ents_by_type[type]);
		
		var init_obj = {};
		
		init_obj.type = type;
		var q = new this.Entity(init_obj);
		this.add_ent(q);
		q.edit_sort = this.ents_by_type[type].length;
		return q;
	};
	
	// used when clicking a "new" button on a master-level ent
	this.new_blank_master = function(type) {
		var init_obj = {};
		
		init_obj.type = type;
		init_obj.master_level = true;
		var q = new this.Entity(init_obj);
		this.add_ent(q);
		return q;
	};
	
	// used when loading existing ents, with contents/values filled in
	this.make_entity = function(obj) {
		var q = new this.Entity(obj);
		this.add_ent(q);
		return q;
	};
	
	// removes passed-in ent from data service, not from backend
	this.delete_ent = function(obj) {
		var i, type = obj.type;
		// remove from main ents list
		for (i = 0; i < this.ents.length; i++) {
			if (obj.id === this.ents[i].id) {
				this.ents.splice(i, 1);
			}
		}
		// remove from types list
		for (i = 0; i < this.ents_by_type[type].length; i++) {
			if (obj.id === this.ents_by_type[type][i].id) {
				this.ents_by_type[type].splice(i, 1);
			}
		}
		this.fix_edit_sort(this.ents_by_type[type]);
	};
	
	// adds newly created entity to appropriate lists
	this.add_ent = function(p_ent) {
		// master-level ents handled separately
		if (p_ent.master_level) {
			this.masters.push(p_ent);
			return;
		}
		
		this.ents.push(p_ent);
		if (angular.isDefined(this.ents_by_type[p_ent.type])) {
			this.ents_by_type[p_ent.type].push(p_ent);
		}
		else {
			this.ents_by_type[p_ent.type] = [];
			this.ents_by_type[p_ent.type].push(p_ent);
		}
	};
	
	// just a getter to fetch an ent by its id
	this.get_ent = function(id) {
		var i;
		for (i = 0; i < this.ents.length; i++) {
			if (this.ents[i].id === id) {
				return this.ents[i];
			}
		}
		return null;
	};
	
	// just a getter to fetch a master ent by id
	this.get_master = function(id) {
		var i;
		for (i = 0; i < this.masters.length; i++) {
			if (this.masters[i].id === id) {
				return this.masters[i];
			}
		}
		return null;
	};
	
	// return a list of ents containing a reference to the passed-in ent
	this.find_ent_in_ents = function(ent) {
		var i, q = [];
		
		for (i = 0; i < this.ents.length; i++) {
			if (this.ents[i].check_for_ent_in_self(ent)) {
				q.push(this.ents[i]);
			}
		}
		return q;
	};
	
	// removes references to a passed-in ent from all ents
	this.clear_ent_from_ents = function(ent) {
		var i, q = [];
		for (i = 0; i < this.ents.length; i++) {
			if (this.ents[i].clear_ent_from_self(ent)) {
				q.push(this.ents[i]);
			}
		}
		return q;
	};
	
	// delete_ent was here
	
	this.get_types = function() {
		q = [];
		for (type in this.ents_by_type) {
			q.push(type);
		}
		return q;
	};
	
}]);

// ***************************************//
// begin directives
// ***************************************//
// the data types (entity, prop, etc) found above will be created automatically by the following directives
// generally you will never create them manually -- e.g. var thing = new Entity();

// as far as the directive goes, really just a special case of an ent with no type
// "ent" attr still defined -- this will behave like an ent, but be stored in this.masters rather than this.ents and 
// not show up in this.ents_by_type
angular.module("muddle").directive("mudMaster", ["data_muddle", function(data_muddle) {
	function controller($scope, $element, $attrs) {
		$scope.master = $scope.$eval($attrs["mudMaster"]);
		
		if (! $scope.hasOwnProperty("mud")) {
			$scope.mud = {};
			$scope.mud.ent = $scope.$eval($attrs["mudMaster"]);
			$scope.mud.current_mud = $scope.mud.ent;
		}
	}
	
	return {
		scope: true
		, restrict: "AE"
		, controller: controller
	};
}]);

// top level data element. defined twice, once at default priority and once at a priority just higher than ng-repeat.
// if mud-ent directive is on element with ng-repeat for a list of ents of a given type, and there are no ents yet, 
// directive will not run until there is at least one ent in list. Therefore the ent's type will not be in ents_by_type dict,
// and bound lists will break.
angular.module("muddle").directive("mudEnt", ["data_muddle", function(data_muddle) {
	function controller($scope, $element, $attrs) {
		$scope.ent = $scope.$eval($attrs["mudEnt"]);
		
		if (! $scope.hasOwnProperty("mud")) {
			$scope.mud = {};
			$scope.mud.ent = $scope.$eval($attrs["mudEnt"]);
			$scope.mud.ent_type = $attrs["mudEntType"];
			$scope.mud.current_mud = $scope.mud.ent;
		}
	}
	
	return {
		scope: true
		, restrict: "AE"
		, controller: controller
	};
}]);

// second mud-ent definition, only purpose is to ensure ent type is in ents_by_type
angular.module("muddle").directive("mudEnt", ["data_muddle", function(data_muddle) {
	function compile(element, attrs) {
		if (attrs.hasOwnProperty("mudEntType")) {
			data_muddle.add_type(attrs.mudEntType);
		}
	};
	
	return {
		compile: compile
		, priority: 1001
	};
}]);

// put this on an input or select element inside a prop to bind the element's value to the prop's value.
// simply adds "ng-model = 'prop.val'" and "ng-model-options = '{getterSetter: true}'", easier than typing it out.
angular.module("muddle").directive("mudBind", ["data_muddle", "$compile", function(data_muddle, $compile) {
	function compile(element, attrs) {
		element.attr("ng-model", "mud.prop.val");
		element.attr("ng-model-options", "{getterSetter: true}");
		element.removeAttr("mud-bind");
		return {
			pre: function pre(scope, elem, attrs, ctrl) {}
			, post: function post(scope, elem, attrs, ctrl) {
				$compile(elem)(scope);
			}
		};
	}
	
	return {
		compile: compile
		, priority: 10000
		, terminal: true
		, restrict: "A"
	};
	
}]);

angular.module("muddle").directive("mudListPropRepeat", ["data_muddle", "$compile", function(data_muddle, $compile) {
	function compile(element, attrs) {
		element.attr("ng-repeat", "__obj in mud.list_prop.enum_list() | orderBy: 'edit_sort'");
		element.removeAttr("mud-list-prop-repeat");
		return {
			pre: function pre(scope, elem, attrs, ctrl) {}
			, post: function post(scope, elem, attrs, ctrl) {
				$compile(elem)(scope);
			}
		};
	}
	
	return {
		compile: compile
		, priority: 10000
		, terminal: true
		, restrict: "A"
	};

}]);

// simplest data field -- simply a value or a reference to another ent
angular.module("muddle").directive("mudProp", ["data_muddle", function(data_muddle) {
	function controller($scope, $element, $attrs) {
		// catching values we might want passed down from higher in the scope chain
		var temp = {};
		// if mud object exists higher on the scope chain but not on this level
		if (! $scope.hasOwnProperty("mud") && $scope.mud) {
			// for the bound prop in a bound list
			if ($scope.mud.bound_id) {
				temp.bound_id = $scope.mud.bound_id;
			}
			// this is the parent object
			if ($scope.mud.current_mud) {
				temp.current_mud = $scope.mud.current_mud;
			}
		}
		
		// build the mud object
		if (! $scope.hasOwnProperty("mud")) {
			$scope.mud = {};
			// should I add a bunch of $scope.hasOwnProperty("blah") ? $scope.blah : null/false
			$scope.mud.parent_obj = temp.current_mud || null; // this really shouldn't ever be null...
			$scope.mud.prop_name = $attrs.mudName;
			$scope.mud.prop_type = $attrs.mudPropType;
			$scope.mud.edit_only = $attrs.hasOwnProperty("mudEditOnly");
			$scope.mud.is_file = $attrs.hasOwnProperty("mudIsFile"); // am I using this?
			$scope.mud.bound_prop = $attrs.hasOwnProperty("mudBoundProp");
			
			// if it's not already on $scope, the 'current_mud' visible from here 
			// is inherited and is our immediate mud parent
			
			// if bound_id is visible from here, it was set on a higher prop_cont scope
			// should I use $broadcast here instead? there may be cases where this can still get confused...
			$scope.mud.prop_val = null;
			if ($scope.mud.bound_prop && temp.bound_id) {
				$scope.mud.prop_val = temp.bound_id;
				$scope.mud.bound_id = null; // and lo it is consumed
			}
			
		}
		
		
		// make sure we've got an prop object
		if ($scope.mud.parent_obj) {
			// make prop if necessary
			if ($scope.mud.parent_obj.get_child($scope.mud.prop_name) == null) {
				$scope.mud.prop = $scope.mud.parent_obj.add_child({ 	type: "prop"
																	, prop_name: $scope.mud.prop_name
																	, prop_type: $scope.mud.prop_type
																	, edit_only: $scope.mud.edit_only
																	, is_file: $scope.mud.is_file
																	, parent: $scope.mud.parent_obj
																	, prop_val: $scope.mud.prop_val});
			}
			// if prop already exists but is not in the scope -- needed when loading from server
			else if (! $scope.mud.prop) {
				$scope.mud.prop = $scope.mud.parent_obj.get_child($scope.mud.prop_name);
			}
		}
		$scope.mud.current_mud = $scope.mud.prop;
		
	};
	
	return {
		controller: controller
		, restrict: "AE"
		, scope: true
		
	};

}]);

// general container, can contain props, list-props, and other prop-conts. can be nested however deep.
angular.module("muddle").directive("mudPropCont", ["data_muddle", function(data_muddle) {
	
	function controller($scope, $element, $attrs) {
		// catching values we might want passed down from higher in the scope chain
		var temp = {};
		// if mud object exists higher on the scope chain but not on this level
		if (! $scope.hasOwnProperty("mud") && $scope.mud) {
			// for the bound prop in a bound list -- wont be used here, just passing through
			if ($scope.mud.bound_id) {
				temp.bound_id = $scope.mud.bound_id;
			}
			// this is the parent object
			if ($scope.mud.current_mud) {
				temp.current_mud = $scope.mud.current_mud;
			}
		}
		
		if (! $scope.hasOwnProperty("mud")) {
			$scope.mud = {};
			$scope.mud.parent_obj = temp.current_mud || null; // this really shouldn't ever be null...
			$scope.mud.prop_cont_name = $attrs.mudName;
			$scope.mud.list_prop_obj = $scope.$eval("__obj") || $scope.$eval($attrs.mudListPropObj) || null;
			
			// if this is an item in a list_prop...
			if ($scope.mud.list_prop_obj) {
				// set name correctly to be unique in list and identify bound ent if necessary
				$scope.mud.base_name = $scope.mud.prop_cont_name;
				$scope.mud.prop_cont_name = $scope.mud.base_name + "__" + $scope.mud.list_prop_obj.ent_id;
				
				// if this prop_cont doesn't exist yet
				if ($scope.mud.parent_obj.get_child($scope.mud.prop_cont_name) == null) {
					$scope.mud.prop_cont_id = $scope.mud.list_prop_obj.ent_id;
				}
				
				// sending the bound_id down to the prop directive child scope that will take the bound value
				$scope.mud.bound_id = null;
				if ($scope.mud.list_prop_obj.bound_child) {
					$scope.mud.bound_id = $scope.mud.list_prop_obj.ent_id.substr(0, $scope.mud.list_prop_obj.ent_id.indexOf("_cont"));
				}
			}
		}
		
		// make sure we've got an prop_cont object
		if ($scope.mud.parent_obj) {
			// make prop_cont if necessary
			if ($scope.mud.parent_obj.get_child($scope.mud.prop_cont_name) == null) {
				$scope.mud.prop_cont = $scope.mud.parent_obj.add_child({ 	type: "prop_cont"
																		, prop_cont_name: $scope.mud.prop_cont_name
																		, parent: $scope.mud.parent_obj
																		, id: $scope.mud.prop_cont_id
																		, bound_id: $scope.mud.bound_id});
			}
			// if prop_cont already exists but not on this scope level -- needed when loading from server
			else if (! $scope.mud.prop_cont) {
				$scope.mud.prop_cont = $scope.mud.parent_obj.get_child($scope.mud.prop_cont_name);
			}
			else {
				// was I doing something here?
			}
		}
		$scope.mud.current_mud = $scope.mud.prop_cont;
		
		// keeps $scope's prop_cont object in sync with actual one... wait why do I need this?
		$scope.$watch(function() {return $scope.mud.prop_cont;}, function(new_val, old_val) {
			$scope.mud.prop_cont = new_val;
		});
	};
	
	return {
		controller: controller
		, restrict: "AE"
		, scope: true
	};
}]);

// list-prop
angular.module("muddle").directive("mudListProp", ["data_muddle", function(data_muddle) {
	
	function controller($scope, $element, $attrs) {
		// catching values we might want passed down from higher in the scope chain
		var temp = {};
		// if ep object exists higher on the scope chain but not on this level
		if (! $scope.hasOwnProperty("mud") && $scope.mud) {
			// for the bound prop in a bound list -- wont be used here, just passing through
			// should I use $broadcast here instead? there may be cases where this can still get confused...
			// especially if it's "just passing through" a list_prop
			// remember restrictions... must go list_prop -> prop_cont -> bound prop...
			// but if prop_cont ALSO contains another list_prop, we may be at the mercy of the order in which the compiler
			// traverses elements.
			if ($scope.mud.bound_id) {
				temp.bound_id = $scope.mud.bound_id;
			}
			// this is the parent object
			if ($scope.mud.current_mud) {
				temp.current_mud = $scope.mud.current_mud;
			}
		}
		
		// build the mud object
		if (! $scope.hasOwnProperty("mud")) {
			$scope.mud = {};
			$scope.mud.parent_obj = temp.current_mud || null ; // this really shouldn't ever be null...
			$scope.mud.list_prop_name = $attrs.mudName;
			$scope.mud.bound_list_type = $attrs.mudBoundListType || null;
			$scope.mud.is_bound_list = $attrs.hasOwnProperty("mudBoundListType");
			if ($scope.mud.is_bound_list) {
				$scope.mud.bound_list = data_muddle.ents_by_type[$scope.mud.bound_list_type];
			}
		}
		
		// make sure we've got a list_prop object
		if ($scope.mud.parent_obj) {
			// make list_prop if necessary
			if ($scope.mud.parent_obj.get_child($scope.mud.list_prop_name) == null) {
				$scope.mud.list_prop = $scope.mud.parent_obj.add_child({ 	type: "list_prop"
																			, list_prop_name: $scope.mud.list_prop_name
																			, parent: $scope.mud.parent_obj
																			, is_bound_list: $scope.mud.is_bound_list
																			, bound_list_type: $scope.mud.bound_list_type});
			}
			// if list_prop already exists but not on this scope level -- needed when loading from server
			else if (! $scope.mud.list_prop) {
				$scope.mud.list_prop = $scope.mud.parent_obj.get_child($scope.mud.list_prop_name);
			}
			else {
				// was I doing something here?
			}
		}
		$scope.mud.current_mud = $scope.mud.list_prop;
		
	};
	
	return {
		controller: controller
		, restrict: "AE"
		, scope: true
	};

}]);

// sticking the file and filename props on the entity, not the prop-cont... not picking up prop-cont?
angular.module("muddle").directive("assetFilepicker", function() {
	function controller($scope, $element, $attrs) {
		if (! angular.isDefined($scope.mud.prop_cont)) {
			console.log("asset-filepicker should be inside a prop-cont, prepare for issues...");
		}
		
		// going to store the filename and the file itself separate child props on the containing prop-cont
		// not creating a new scope or mud object here.
		// so, first make one for the filename...
		if (! $scope.mud.current_mud.get_child("filename")) {
			// ...make one
			$scope.mud.filename_prop = $scope.mud.current_mud.add_child({ 	type: "prop"
																			, prop_name: "filename"
																			, prop_type: "val"
																			, edit_only: false
																			, is_file: false
																			, parent: $scope.mud.current_mud
																			, prop_val: null});
		}
		// under what conditions do I need this? loading from server?
		else if (! $scope.mud.hasOwnProperty("filename_prop")) {
			$scope.mud.filename_prop = $scope.mud.current_mud.get_child("filename");
		}

		// and now one for the file itself
		if (! $scope.mud.current_mud.get_child("file")) {
			$scope.mud.file_prop = $scope.mud.current_mud.add_child({ 	type: "prop"
																		, prop_name: "file"
																		, prop_type: "val"
																		, edit_only: false
																		, is_file: true
																		, parent: $scope.mud.current_mud
																		, prop_val: null});
		}
		// under what conditions etc, see above
		else if (! $scope.mud.hasOwnProperty("file")) {
			$scope.mud.file_prop = $scope.mud.current_mud.get_child("file");
		}
		
		// keeping everything square...
		$element.on("change", function(evt) {
			// set file prop
			$scope.mud.file_prop.val(evt.target.files[0]);
			$scope.mud.file_prop.val_is_file = true;
			// now the filename
			$scope.mud.filename_prop.val(event.target.files[0].name);
			$scope.$apply();
		});
		
		// sets input element to file if val changes... will this ever happen? how would this even happen?
		$scope.$watch(function() {return $scope.mud.file_prop.val();}, function(new_val, old_val) {
			$element[0].files[0] = $scope.mud.file_prop.val();
		});
	}
	
	return {
		controller: controller
		, restrict: "A"
	}
});

// ***************************************//
// end directives
// ***************************************//


// simple for interacting with backend
angular.module("muddle").service("muddle_backend", ["data_muddle", "$http", "$window", function(data_muddle, $http, $window) {
	this.data_muddle = data_muddle;
	var srv = this;
	
	// save master-level entity
	// master-level entities are whole sets of data across which data is not shared... If this is an app for
	// storing employees in a company, a master-level ent is the company. If this is an app for creating monsters and
	// items for a game, a master-level ent is the whole game. You may only need one -- if so, you don't have to use
	// this feature. If you never define a master-level ent, all ents will be saved under a default master ent with a null id
	// in the db.
	// if using master-level entities, don't let the user save regular ents unless they've created, selected, and saved
	// a master-level ent. If they save an ent assigned to a master-level, and don't save the master-level ent,
	// the ent will be orphaned in the db.
	
	
	// load all entities for a given master
	// pass a master ent if using masters... Otherwise it will load all ents under the default null master id
	this.load_master = function(master) {
		var that = this, params = {master_id: false};
		if (angular.isDefined(master)) {
			params.master_id = master.id;
		}
		
		return $http.post("/load_master/", params).then(
			// success
			function(payload) {
				that.data_muddle.unpack_loaded_ents(payload.data);
			},
			// failure 
			function(payload) {
				console.log("load_master failed");
				console.log(payload);
				return payload;
			}
		);
	};
	
	this.load_all_masters = function() {
		var that = this;
		return $http.get("/load_all_masters/").then(
			// success
			function(payload) {
				// hoo boy this next bit is ugly, but it works. Puts a "default" option at the beginning of the masters list
				// drawback is the null_master will always be first with edit_sort of 1... if you try to use edit_sort in the masters list, 
				// you'll run into problems. An better solution would be to check if there's a default null master after loading, then if not
				// construct one as an actual master-level entity, then save it.
				var null_master = {id: null, get_child: function() {return {val: function() {return "Default";}}}};
				that.data_muddle.masters.push(null_master);
				that.data_muddle.unpack_loaded_ents(payload.data);
			},
			// fail
			function(payload) {
				console.log("load_all_masters failed");
				console.log(payload);
				return payload;
			}
		);
	};
	
	// save entities
	this.save = function(param, current_master) {
		var save_list, i, files, form, master;
		
		if (current_master == null) {
			// did not pass current_master, will be saved under default master with null id
			master = false;
		}
		else {
			master = current_master;
		}
		
		// make sure we're dealing with an array
		// would it be better for the first test to be (param.type && param.type === "ent") ?
		if (param.constructor != Array) {
			save_list = [param];
		}
		else {
			save_list = param;
		}
		
		// pull out files for assets
		files = [];
		for (i = 0; i < save_list.length; i++) {
			files = files.concat( save_list[i].fetch_files() );
		}
		
		// make a form object... have to do this to save the files anyway
		form = new FormData;
		for (i = 0; i < files.length; i++) {
			form.append(files[i].prop_id, files[i].file);
		}
		form.append("save_list", JSON.stringify(save_list));
		form.append("master", JSON.stringify(master));
		
		// actually save
		return $http.post("/save_entities/", form, {transformRequest: angular.identity, headers: {"Content-Type": undefined}}).then(
			// success
			function(payload) {
				// set modified back to false for everything we just saved
				for (i = 0; i < save_list.length; i++) {
					save_list[i].modified = false;
				}
				return save_list;
			},
			// fail
			function(payload) {
				console.log("save failed...");
				console.log(payload);
				return payload;
			});
	};
	
	// delete entities from backend, not data service
	this.delete = function(param) {
		var del_list, i, master;
		
		// make sure we're dealing with an array
		// would it be better for the first test to be (param.type && param.type === "ent") ?
		if (param.constructor != Array) {
			del_list = [param];
		}
		else {
			del_list = param;
		}
		
		return $http.post("/delete_entities/", del_list).then( 
			// success
			function(payload) {
				// delete from front-end on success
				// first part not yet tested
				var i;
				for (i = 0; i < del_list.length; i++) {
					srv.data_muddle.delete_ent(del_list[i]);
				}
				return del_list;
			},
			// failure
			function(payload) {
				console.log("delete entities failed");
				console.log(payload);
				return payload;
			}
		);
	};
	
	// export this company's data as a zip containing a json file and, eventually (but not yet), any uploaded files
	// to do: implement the uploaded files part
	this.export_master = function(master) {
		var params = {master_id: false};
		if (angular.isDefined(master)) {
			params.master_id = master.id;
		}
		console.log("here");
		// surely there's a better way to do this
		var a = angular.element("<a/>");
		a.attr({ 	href: "/export_master/?master_id=" + params.master_id
					, type: "application/force-download"
					}
				)[0].click();
	};
	

}]);

// random because this should be in angular to begin with
angular.module("muddle").filter("capitalize", [function() {
	return function(word) {
		return (!!word) ? word.charAt(0).toUpperCase() + word.substr(1).toLowerCase() : "";
	};
}]);
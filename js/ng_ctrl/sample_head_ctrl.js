function sample_head_ctrl(data_muddle, current) {
	var self = this;
	self.dm = data_muddle;
	self.current = current;
	
	// testing/troubleshooting
	self.log_current = function() {
		console.log("current entity: ", self.current.entity());
		console.log("current type: ", self.current.type());
		console.log("current master: ", self.current.master());
		console.log("whole dm service: ", self.dm);
	};
}
angular.module("mud_app").controller("sample_head_ctrl", ["data_muddle", "current", sample_head_ctrl]);
angular.module("mud_app").component("sampleHead", {
	bindings: {}
	, controller: ["data_muddle", "current", sample_head_ctrl]
	, controllerAs: "s_head"
	, templateUrl: "templates/sample_head.html"
});
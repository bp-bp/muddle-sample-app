function sample_head_ctrl(data_muddle, current) {
	// testing/troubleshooting
	self.log_current = function() {
		console.log("current entity: ", self.current.entity());
		console.log("current type: ", self.current.type());
		console.log("current master: ", self.current.master());
	};
}
angular.module("mud_app").controller("sample_head_ctrl", ["data_muddle", "current", sample_head_ctrl]);
angular.module("mud_app").component("sampleHead", {
	bindings: {}
	, controller: ["data_muddle", "current", sample_head_ctrl]
	, controllerAs: "s_head"
	, templateUrl: "templates/sample_head.html"
});
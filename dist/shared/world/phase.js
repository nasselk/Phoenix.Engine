export var Phase;
(function (Phase) {
    Phase[Phase["Input"] = 0] = "Input";
    Phase[Phase["PreUpdate"] = 100] = "PreUpdate";
    Phase[Phase["Update"] = 200] = "Update";
    Phase[Phase["PostUpdate"] = 300] = "PostUpdate";
    Phase[Phase["Network"] = 400] = "Network";
    Phase[Phase["Render"] = 500] = "Render";
})(Phase || (Phase = {}));

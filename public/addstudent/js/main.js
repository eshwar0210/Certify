$(document).ready(function () {
  "use strict";

  // Apply .has-val if the field is not empty on load
  $(".input100").each(function () {
    if ($(this).val().trim() !== "") {
      $(this).addClass("has-val");
    }
  });

  // Add or remove .has-val on blur event
  $(".input100").on("blur", function () {
    if ($(this).val().trim() !== "") {
      $(this).addClass("has-val");
    } else {
      $(this).removeClass("has-val");
    }
  });
});

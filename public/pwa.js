if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
        .then(reg => console.log('service worker registered'))
        .catch(err => console.log('service worker not registered', err));
    alertMissingFeatures();
} else {
    alert("Your browser does not support some features. Please upgrade to latest version Chrome/Firefox.\nOr make sure you are not in Incognito/Private Mode")
}
// queryselector templatestrings es6array arrow es6object promises es6string filereader fetch atobbtoa atob-btoa classlist rgba no-capture fileinput placeholder canvas todataurljpeg todataurlpng no-todataurlwebp opacity mediaqueries cssvhunit cssanimations borderradius boxshadow flexbox userselect

function alertMissingFeatures() {
    let htmlclassAttr = document.querySelector("html").getAttribute("class") || "";
    let htmlclasses = htmlclassAttr.split(" ");
    let missingfeatureList = htmlclasses.filter((cls) => cls.indexOf("no-") == 0);
    if (missingfeatureList.length > 0) {
        let ignorelist = missingfeatureList.filter((minor) => (minor != "no-cssvhunit" && minor != "no-capture" && minor != "no-userselect" && minor != "no-todataurlwebp" && minor != "no-todataurlpng" && minor != "no-todataurljpeg"));
        if (ignorelist.length > 0) {
            document.querySelector(".container").style.display = "none";
            fetch("../missingfeature/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nofeature: missingfeatureList.join(","), agent: btoa(navigator.userAgent) }) })
                .then(data => data.json())
                .then((s) => {
                    console.log(s)
                });

            alert("Sorry, your device does not support modern features. Please try upgrading to latest Google Chrome.");
        }
    }
}
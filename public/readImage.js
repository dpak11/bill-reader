let captureImg = document.getElementById('captureImg');
let fileImg = document.getElementById('fileImg');
let staticfile = window.location.href.indexOf("?file=") > 0 ? window.location.href.split("file=")[1] : "";


captureImg.addEventListener('change', () => {
    imageProcess(captureImg.files[0]);

});

fileImg.addEventListener('change', () => {
    imageProcess(fileImg.files[0]);

});


function imageProcess(imgfile) {
    if (imgfile.type.indexOf("image/") > -1) {
        let img = document.querySelector('.previewimg img');
        document.querySelector('.lds-roller').classList.remove("hide");

        let fileReader = new FileReader();
        fileReader.onload = function(fileLoadedEvent) {
            let srcData = fileLoadedEvent.target.result; // <--- data: base64            
            console.log("Init processing....\n" + srcData);
            img.src = srcData;
            document.querySelector('.lds-roller').classList.remove("hide");

            fetch("../processimage/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ img: srcData }) })
                .then(data => data.json())
                .then(function(json) {
                    console.log(json.status);
                    document.querySelector('.previewimg').classList.remove("hide");
                    document.querySelector(".lds-roller").classList.add("hide");
                    displayBillingTable(json.status);
                }).catch(function(s) {
                    console.log("fetch API failed..");
                    console.log(s);
                    document.querySelector(".lds-roller").classList.add("hide");
                });
        }

        if (staticfile != "") {
            fetch(staticfile).then(resp => resp.blob())
                .then(blob => {
                    console.log("IMG:" + staticfile);
                    fileReader.readAsDataURL(blob);
                })
        } else {
            console.log("IMG:" + imgfile);
            fileReader.readAsDataURL(imgfile);
        }


    } else if (imgfile.type.indexOf("audio/") > -1) {
        alert("Expecting an Image file")
    } else if (imgfile.type.indexOf("video/") > -1) {
        alert("Expecting an Image file")
    }

}

function displayBillingTable(data) {
    document.getElementById("billTable").classList.remove("hide");
    document.getElementById("date_field").value = data.date || "";
    document.getElementById("merchant_field").value = data.title || "";
    document.getElementById("amount_field").value = data.total || "";


}


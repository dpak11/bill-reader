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
        let img = document.getElementById('previewimg');

        let fileReader = new FileReader();
        fileReader.onload = function(fileLoadedEvent) {
            let srcData = fileLoadedEvent.target.result; // <--- data: base64            
            console.log("Init processing....\n" + srcData);
            img.src = srcData;
            document.getElementById("previewimg").style.display="block";

            fetch("../processimage/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ myimg: srcData }) })
                .then(data => data.json())
                .then(function(json) {
                    console.log(json.status);
                }).catch(function(s) {
                    console.log("fetch API failed..");
                    console.log(s)

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
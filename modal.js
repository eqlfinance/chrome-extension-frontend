try {
    if(document.getElementById("eql-div")){
        document.getElementById("eql-div").remove()
    }
    const xmlhttp = new XMLHttpRequest();
    xmlhttp.open("GET", chrome.runtime.getURL('./modal.html'), false);
    xmlhttp.send();
    const html = xmlhttp.responseText;

    const parent = document.createElement('div')
    parent.innerHTML = html
    parent.id = "eql-div"
    document.body.appendChild(parent)

    const openModal = document.getElementsByClassName("open-modal")[0];
    const openModalPic = document.getElementById("open-modal-pic");

    openModalPic.setAttribute('src', chrome.runtime.getURL('./res/images/EQLLOGOBIGGER.svg'))
    var blinking = false

    const modalSwitchState = (which) => {
        switch (which) {
            case "no offers":
                openModal.style.backgroundColor = "#1B1B1B"
                chrome.runtime.sendMessage('store name', (response) => {
                    if(response){
                        document.getElementById("open-modal-text").innerHTML = "No offers available for " + response + "."
                    }else{
                        document.getElementById("open-modal-text").innerHTML = "No offers available."
                    }
                    expandModel()
                })

                break;
            case "offers":
                openModal.style.backgroundColor = "#0B9A70"
                document.getElementById("open-modal-text").innerHTML = "Offers Availble! <br><br> Click the Extension Icon on your browser above."
                expandModel()
                break;
        }

    }

    const expandModel = () => {
        if(!blinking){
            var iterations = 0
            blinking = true
            setInterval(() => {
                iterations++;
                if(iterations%2 == 1){
                    openModal.style.display = 'none'
                }else{
                    openModal.style.display = 'flex'
                }
            },15000)
        }

        openModal.style.width = "250px"
        openModal.style.height = "100px"
        setTimeout(() => {
            openModal.style.width = "50px"
            openModal.style.height = "50px"
        }, 3456)
    }

    const loadOffers = () => {
        chrome.runtime.sendMessage('offers', (response) => {
            if(response && response.length > 0){
                modalSwitchState("offers")
            }else{
                modalSwitchState("no offers")
            }
        })
    }

    chrome.runtime.sendMessage('status for modal', (response) => {
        if(response.message){
            openModal.style.backgroundColor = response.color
            document.getElementById("open-modal-text").innerHTML = response.message
            expandModel()

        }else{
            openModal.style.backgroundColor = "#0B9A70"
            loadOffers()
        }
    })


    openModal.addEventListener('mouseover', () => {
        openModal.style.width = "250px"
        openModal.style.height = "100px"
    })

    openModal.addEventListener('mouseout', () => {
        openModal.style.width = "50px"
        openModal.style.height = "50px"
    })

} catch (error) {
    console.log("Modal popup error", error)
}

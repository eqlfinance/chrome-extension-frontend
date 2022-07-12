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
            })

            break;
        case "offers":
            openModal.style.backgroundColor = "#0B9A70"
            document.getElementById("open-modal-text").innerHTML = "Offers Availble! <br><br> Click the Extension Icon on your browser above."
            break;
    }
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

const xmlhttp = new XMLHttpRequest();
xmlhttp.open("GET", chrome.runtime.getURL('./modal.html'), false);
xmlhttp.send();
const html = xmlhttp.responseText;

const parent = document.createElement('div')
parent.innerHTML = html
document.body.appendChild(parent)

const openModal = document.getElementsByClassName("open-modal")[0];
const openModalPic = document.getElementById("open-modal-pic");

openModalPic.setAttribute('src', chrome.runtime.getURL('res/images/eql-app-img.png'))
openModal.onmouseout = () => {
    setTimeout(() => {
        openModal.style.display = 'none'
    }, 2000)
}

chrome.runtime.sendMessage('status for modal', (response) => {
    if(response){
        openModal.style.backgroundColor = "#1B1B1B"
        document.getElementById("open-modal-text").innerHTML = response
    }else{
        loadOffers()
    }
})

//The modal disappears after 45 seconds
setTimeout(() => {
    openModal.style.display = 'none'
}, 1000*45)


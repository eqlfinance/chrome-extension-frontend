const cd = document.getElementById('couponDiv')
const lf = document.getElementsByClassName('login')[0]
const postlogindiv = document.getElementById("post-login")
const postloginbutton = document.getElementById("post-login-done")
const offerDiv = document.getElementById("eql-offer-display")
const topChildren = document.getElementsByClassName("top")[0]?.children
const forgotForm = document.getElementById("forgotForm")
const forgotButtonDiv = document.getElementById("forgot-button-div")
const cachedOffers = []

const popupSwitchState = (which) => {
    switch (which) {
        case "login":
            lf.style.display = 'flex'
            for (let index = 0; index < topChildren.length; index++) {
                const element = topChildren[index];
                element.style.visibility = "visible"
            }
            postlogindiv.style.display = 'none'
            forgotForm.style.display = 'none'
            offerDiv.style.display = 'none'
            break;
        case "post login":
            lf.style.display = 'none'
            document.querySelector('.top').style.border = "none"
            for (let index = 0; index < topChildren.length; index++) {
                const element = topChildren[index];
                element.style.visibility = "hidden"
            }
            postlogindiv.style.display = 'flex'
            forgotForm.style.display = 'none'
            offerDiv.style.display = 'none'
            break;
        case "logged in":
            lf.style.display = 'none'
            postlogindiv.style.display = 'none'
            forgotForm.style.display = 'none'
            for (let index = 0; index < topChildren.length; index++) {
                const element = topChildren[index];
                element.style.visibility = "visible"
            }
            offerDiv.style.display = 'flex'

            chrome.runtime.sendMessage('offers', (response) => {
                fillPopup(response)
            })

            break;
        case "forgot":
            document.getElementById('status2').style.display = 'none'
            lf.style.display = 'none'
            postlogindiv.style.display = 'none'
            forgotForm.style.display = 'flex'
            for (let index = 0; index < topChildren.length; index++) {
                const element = topChildren[index];
                element.style.visibility = "visible"
            }
            offerDiv.style.display = 'none'
            break;
    }
}

chrome.runtime.sendMessage('logged in', (response) => {
    if(response){
        popupSwitchState("logged in")
    }else{
        popupSwitchState("login")
    }
})


const fonts = [
    new FontFace('Gilroy-Bold', `url(${chrome.runtime.getURL('./res/font/Gilroy-Bold.ttf')})`),
    new FontFace('Gilroy-Medium', `url(${chrome.runtime.getURL('./res/font/Gilroy-Medium.ttf')})`),
    new FontFace('Gilroy-SemiBold', `url(${chrome.runtime.getURL('./res/font/Gilroy-SemiBold.ttf')})`)
]

fonts.forEach((font) => {
    font.load().then((f) => {
        document.fonts.add(f);
    }).catch((err) => console.log(err));
})

var elementactivated = null
const offerElementClick = (ev) => {
    var element = ev.target

    if(element.tagName != 'DIV'){
        element = element.parentElement
    }

    if(elementactivated == element){
        return 
    }

    elementactivated = element

    const title = element.querySelector('#title')
    const code = element.querySelector('#code')
    const offerInst = element.querySelector('#inst')
    const id = parseInt(element.querySelector('#id').innerHTML)

    var values = [title.innerHTML, code.innerHTML]
    chrome.runtime.sendMessage({selectedOffer: cachedOffers[(cachedOffers.length)-id-1]}, (response) => {

        title.innerHTML = response.title.replaceAll("|", values[1])
        code.innerHTML = response.sub.replaceAll("|", values[1])
        element.style.backgroundColor = "#0B9A70"
        
        let children = offerDiv.querySelectorAll(".eql-offer")
        for (let index = 0; index < children.length; index++) {
            const element = children[index];
            element.style.pointerEvents = "none"
        }

        let copy = [new ClipboardItem({ "text/plain": new Blob([values[1]], { type: "text/plain" }) })]
        navigator.clipboard.write(copy).then(() => {
            
        }, () => {
            console.log("Copy error")
        })
        setTimeout(() => {
            offerDiv.removeAttribute('disabled')
            title.innerHTML = values[0]
            code.innerHTML = values[1]
            element.style.backgroundColor = "#1B1B1B"

            for (let index = 0; index < children.length; index++) {
                const element = children[index];
                element.style.pointerEvents = "auto"
            }

            setTimeout(() => {
                window.close()
            }, 2000)
        }, 7000)
    })

}

const createOfferElement = (offer, idx) => {
    let offerElement = document.createElement('div')
    offerElement.className = "eql-offer"

    let offerTitle = document.createElement('p')
    offerTitle.id = "title"
    offerTitle.innerHTML = "" + offer.name
    offerElement.appendChild(offerTitle)

    let offerCode = document.createElement('p')
    offerCode.id = "code"
    offerCode.innerHTML = "" + offer.code
    offerElement.appendChild(offerCode)

    let offerInst = document.createElement('p')
    offerInst.id = "inst"
    offerInst.innerHTML = "(Click to Apply Offer)"
    offerInst.style.display = "none"
    offerElement.appendChild(offerInst)

    let offerid = document.createElement('p')
    offerid.id = "id"
    offerid.innerHTML = idx
    offerid.style.display = "none"
    offerElement.appendChild(offerid)
    
    offerElement.setAttribute('title', 'Click to copy or apply offer code')

    offerElement.onclick = offerElementClick
    offerElement.onmouseover = () => {
        offerInst.style.display = "block"
    }
    offerElement.onmouseout = () => {
        offerInst.style.display = "none"
    }

    return offerElement
}

const fillPopup = (offers) => {
    //CUSTOMER TOUCH POINT: They opened the extension

    offers.forEach((offer) => {
        cachedOffers.push(offer)
    })

    for (let index = 0; index < offerDiv.children.length; index++) {
        const element = offerDiv.children[index];

        if(element.className != "login-button-holder"){
            offerDiv.removeChild(element);
        }
    }
    
    if(offers.length > 0){
        for (let index = 0; index < offers.length; index++) {
            const offer = offers[index];
            offerDiv.prepend(createOfferElement(offer, index))
        }
        
    }else{
        element = document.createElement('div')
        element.id = 'eql-no-offers'

        chrome.runtime.sendMessage('store name', (response) => {
            if(response){
                element.innerHTML = 'No offers found for ' + response + "."
            }else{
                element.innerHTML = 'No offers found.'
            }
            offerDiv.prepend(element)
        })
        
    }
}

lf?.addEventListener('submit', (e) => {
    //CUSTOMER TOUCH POINT: They logged in to EQL from the popup login form        
    let email = document.getElementById('loginForm').elements['email'].value
    let password = document.getElementById('loginForm').elements['password'].value

    chrome.runtime.sendMessage({email:email, password:password}, (response) => {
        if(response === 'mk'){
            document.getElementsByClassName('incorrect')[0].style.display = 'none'

            document.getElementById('pwDiv').style.borderColor = "#BDBDBE"
            document.getElementById('pwText').style.color = "#3D3E3F"

            popupSwitchState("post login")
        }else{
            document.getElementsByClassName('incorrect')[0].style.display = 'block'

            document.getElementById('pwDiv').style.borderColor = "#c51717"
            document.getElementById('pwText').style.color = "#c51717"
        }
    })

    e.preventDefault()
})



document.getElementById("eye")?.addEventListener('click', () => {
    let field = document.getElementsByClassName('input')[1]
    let eye = document.getElementById("eye")
    let type = field.getAttribute('type')

    if(type == 'password'){
        field.setAttribute('type', 'text')
        eye.setAttribute('src', './res/images/eye-2.png')
    }else{
        field.setAttribute('type', 'password')
        eye.setAttribute('src', './res/images/eye-1.png')
    }
})

postloginbutton?.addEventListener('click', () => {
    popupSwitchState("logged in")
})
document.getElementById("forgot")?.addEventListener('click', () => {
    popupSwitchState('forgot')
})
document.getElementById("forgotForm")?.addEventListener('submit', (e) => {
    let email = document.getElementById('forgotForm').elements['email'].value

    chrome.runtime.sendMessage({resetEmail:email}, (response) => {
        if(response == null){
            document.getElementById('check').style.visibility = 'visible'
            document.getElementById('status2').style.display = 'none'
            document.getElementById('resetEmail').style.borderColor = "#1ABB1C"
        }else{
            document.getElementById('resetEmail').style.borderColor = "#c51717"
            document.getElementById('status2').style.display = 'flex'
            document.getElementById('resetErrorText').style.display = 'block'
            document.getElementById('resetErrorText').innerHTML = "Email invalid or other error"
        }
    })

    e.preventDefault()
})
document.getElementById('forgot-back')?.addEventListener('click', () => {
    popupSwitchState('login')
})
document.getElementById("eqlimg")?.addEventListener('click', () => {
    //CUSTOMER TOUCH POINT: They opened the eql website from the popup image
    chrome.tabs.create({url: "https://www.eqlfinance.com"})
})
document.getElementById("eqlbutton")?.addEventListener('click', () => {
    //CUSTOMER TOUCH POINT: They opened the eql website from the popup bottom button
    chrome.tabs.create({url: "https://www.eqlfinance.com"})
})
document.getElementById("signup")?.addEventListener('click', () => {
    //CUSTOMER TOUCH POINT: They requested signup from the popup login form
    chrome.tabs.create({url: "https://www.eqlcash.com/authentication/sign-up"})
})
document.getElementById("close")?.addEventListener('click', () => {
    window.close()
})
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

const offerDiv = document.getElementById("eql-offer-display")

const couponKeywordRegex = /(coupon|discount|promo|claimcode)/

const findCouponCodeEntry = () => {
    let found = false
    let inputs = document.querySelectorAll('input[type=text]');

    for (index = 0; index < inputs.length; index++) {
        let input = inputs[index]
        let attribs = Array.from(input.attributes)

        for (let index2 = 0; index2 < attribs.length; index2++) {
            const attr = attribs[index2];
            
            if(attr.nodeName.toLowerCase().match(couponKeywordRegex) ||
                attr.nodeValue.toLowerCase().match(couponKeywordRegex)){
                    found = true
                    break;
            }
        }

        if(found){
            return input  
        }
    }

    return null
}

const offerElementClick = (ev) => {
    console.log(ev.target)
    var element = ev.target

    if(element.tagName != 'DIV'){
        element = element.parentElement
    }

    const title = element.querySelector('#title')
    const code = element.querySelector('#code')
    // const id = element.querySelector('#id')

    var values = [title.innerHTML, code.innerHTML]

    let input = findCouponCodeEntry()

    if(input){
        input.setAttribute('value', values[1])
        input.value = values[1]
    }else{
        alert("Coupon entry not found. Press Ok to copy the code to your clipboard")
    }

    chrome.runtime.sendMessage({selectedOffer:values[1]})

    let copy = [new ClipboardItem({ "text/plain": new Blob([values[1]], { type: "text/plain" }) })]
    navigator.clipboard.write(copy).then(() => {
        title.innerHTML = values[1] + " copied!"
        code.innerHTML = ""
        setTimeout(() => {
            title.innerHTML = values[0]
            code.innerHTML = values[1]
        }, 2000)
    }, () => {
        title.innerHTML = "Copy error"
        code.innerHTML = ""
        setTimeout(() => {
            title.innerHTML = values[0]
            code.innerHTML = values[1]
        }, 2000)
    })
}

const createOfferElement = (offer) => {
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
    offerInst.innerHTML = "(Click to redeem offer)"
    offerInst.style.display = "none"
    offerElement.appendChild(offerInst)

    let offerid = document.createElement('p')
    offerid.id = "id"
    offerid.innerHTML = offer.offer_key
    offerid.style.display = "none"
    offerElement.appendChild(offerid)
    
    offerElement.setAttribute('title', 'Click to copy coupon code')

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
    var child = offerDiv.lastElementChild; 
    while (child) {
        offerDiv.removeChild(child);
        child = offerDiv.lastElementChild;
    }
    
    if(offers.length > 0){
        offers.forEach(offer => {
            
            offerDiv.appendChild(createOfferElement(offer))
        });
    }else{
        element = document.createElement('div')
        element.id = 'eql-no-offers'

        chrome.runtime.sendMessage('store name', (response) => {
            if(response){
                element.innerHTML = 'No offers found for ' + response + "."
            }else{
                element.innerHTML = 'No offers found.'
            }
            offerDiv.appendChild(element)
        })
        
    }
}


chrome.runtime.sendMessage('offers', (response) => {
    fillPopup(response)
})

document.getElementById("eql-banner-img")?.addEventListener('click', () => {
    //CUSTOMER TOUCH POINT: They opened the eql website from the popup image
    chrome.tabs.create({url: "https://www.eqlfinance.com"})
})
document.getElementById("eql-link-button")?.addEventListener('click', () => {
    //CUSTOMER TOUCH POINT: They opened the eql website from the popup image
    chrome.tabs.create({url: "https://www.eqlfinance.com"})
})
document.getElementById("eql-banner-close")?.addEventListener('click', () => {
    window.close()
})
var statusForModal = {color: null, message: null}
var taken_coupon_code = false
const backendBaseURL =  "https://eql-saver-extension.herokuapp.com/"


chrome.runtime.onInstalled.addListener((details) => {
    chrome.tabs.create({
        url: chrome.runtime.getURL('post-download-upgrade.html')
    })
});

function readFromChromeStorage(key) {
    return new Promise((resolve, reject) => {
        if (key != null) {
            chrome.storage.sync.get(key, function (obj) {
                resolve(obj);
            });
        } else {
            reject(null);
        }
    });
}

const loginToEQL = async (userDetails) => {
    return chrome.cookies.get({url: backendBaseURL, name:"eql_user_member_key"})
    .then((cookie) => {
        if(cookie && cookie.value){
            console.log('User logged in already')
            return true
        }else{
            return fetch(backendBaseURL + "api/eql-login", {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: userDetails.email,
                    password: userDetails.password
                })
            })
            .then(async (res) => {
                console.log(res)
                let response = await res.json()
                console.log("Login to EQL response", response)

                if(!response.jwt){
                    return false
                }else{
                    await chrome.cookies.set({httpOnly: true, secure: true, url: backendBaseURL, name:"eql_user_member_key", value: response.mk})
                    await chrome.cookies.set({httpOnly: true, secure: true, url: backendBaseURL, name:"eql_strapi_jwt", value: response.jwt})
    
                    let cookies = await chrome.cookies.getAll({url: backendBaseURL})
                    console.log("Cookies:", cookies)
                    
                    if(chrome.runtime.lastError){
                        console.log("Chrome experienced error:", chrome.runtime.lastError)
                        return false
                    }else{
                        chrome.tabs.onUpdated.addListener(onStoreListener)
                        return true
                    }
                }
            }).catch((err) => {
                return false
            })
        }
    })
}

const searchAPIRequest = async (url) => {
    return chrome.cookies.get({url: backendBaseURL, name:"eql_strapi_jwt"}).then((cookie) => {
        if(!cookie){
            throw "Unreachable unless the server down searchAPIRequset"
        }
        return cookie
    }).then((cookie) => {
        if(!url){
            return []
        }else{
            console.log("Searching domain", url)
            return fetch(backendBaseURL + "api/domains?search=" + url)
            .then(async (res) => {
                if(res.status == 403 || res.status == 401){
                    throw `${res.status} status code on SearchApiRequest`
                }

                console.log("Got response from search")
                return res.json()
            }).catch((err) => {
                console.log("Error on search api request ", err)
                return []
            })
        }
    })
}

const getOffersForUser = (url) => {
    return searchAPIRequest(url).then(async (offers) => {
        console.log("getOffersForUser recieved offers", offers)

        return chrome.cookies.get({url: backendBaseURL, name:"eql_strapi_jwt"}).then((cookie) => {
            if(!cookie){
                throw "Unreachable unless the server down searchAPIRequset"
            }

            return cookie
        }).then((cookie) => {
            if(!cookie){
                throw "Unreachable unless the server down getOffersForUser"
            }
    
            return null
        }).then(() => {
            return chrome.cookies.get({url: backendBaseURL, name:"eql_user_member_key"})
        })
        .then(async (cookie) => {
            let userCaRedeem = []

            for (const offer of offers){
                console.log("Getting uses remaining for", offer)
                await fetch(backendBaseURL + "api/uses-remaining?" + new URLSearchParams({
                    offerKey: offer.offer_key,
                    memberKey: cookie.value
                }))
                .then((res) => {return res.json()})
                .then(async (redeemData) => {
                    console.log("Redeem data", redeemData)
                    if((redeemData.message && redeemData.status == 200) ||
                    (redeemData.offers && redeemData.offers[0].offer_uses_remaining.usable)){
                        return true
                    }else{
                        return false
                    }
                }).then((can) => {
                    console.log("Can user redeem=", can)
                    if(can) userCaRedeem.push(offer)
                })
            }
            return userCaRedeem
        })
        .catch((err) => {
            console.log("Error on getOffersForUser", err)
            return []
        })
    })
}

const loadFonts = () => {
    const fonts = [
        new FontFace('Gilroy-Bold', `url(${chrome.runtime.getURL('./res/font/Gilroy-Bold.ttf')})`),
        new FontFace('Gilroy-Medium', `url(${chrome.runtime.getURL('./res/font/Gilroy-Medium.ttf')})`),
        new FontFace('Gilroy-SemiBold', `url(${chrome.runtime.getURL('./res/font/Gilroy-SemiBold.ttf')})`)
    ]
    
    fonts.forEach((font) => {
        font.load().then((f) => {
            document.fonts.add(f);
        }).catch((err) => {});
    })
}

const getStoreName = async () => {
    return chrome.tabs.query({active: true})
    .then((tabs) => {
        let url = tabs[0].url
        if(url.startsWith("chrome://")){
            return "site"
        }

        try {
            let storeName = url.match(/(?:http|https)\:\/\/(?:www\.)?(?:(?:[a-zA-z0-9\-]*\.)*)(([a-zA-z0-9\-]*)\.[a-z]{2,3})/)[2]
            return storeName
        } catch (error) {
            return "site"
        }
    }) 
}


const offerCodeEntry = (code) => {
    var inputs = document.querySelectorAll("input[type=text]");
    var buttons = document.querySelectorAll("input[type=button], button");
    var selectedInput = null
    var selectedButton = null
    const inputMatchString = /(discount|coupon|offer|promo)/

    const findKeywordInElement = (element) => {
        if(element.innerHTML.toLowerCase().match(inputMatchString)){
            return true
        }

        let attributes = Array.from(element.attributes)

        for (let index2 = 0; index2 < attributes.length; index2++) {
            const attr = attributes[index2];

            if(attr.nodeName.toLowerCase().match(inputMatchString) != null ||
            attr.nodeValue.toLowerCase().match(inputMatchString) != null){
                return true
            }
        }

        return false
    }

    const searchThisAndChildren = (element) => {
        if(findKeywordInElement(element)){
            return true
        }else{
            for (let index = 0; index < element.children.length; index++) {
                const child = element.children[index];
                if(findKeywordInElement(child)){
                    return true
                }
            }

            return false
        }
    }

    for (let index = 0; index < inputs.length; index++) {
        const input = inputs[index];
        
        if(input){
            if(searchThisAndChildren(input)){
                selectedInput = input;
                input.setAttribute('value', code)
                input.value = code
    
                input.dispatchEvent(new Event('input', {bubbles: true, cancelable: false, composed:true}))
                input.dispatchEvent(new Event('blur', {bubbles: true, cancelable: false, composed:true}))
                break;
            }
        }

        if(selectedInput) break;
    }

    if(!selectedInput){
        return "No input found"
    }else{
        for (let index = 0; index < buttons.length; index++) {
            const button = buttons[index];
            
            if(button){
                if(searchThisAndChildren(button)){
                    selectedButton = button;
                    button.click()
                    break;
                }
            }
    
            if(selectedButton) break;
        }

        if(!selectedButton){
            return "No button found"
        }
    }

    return null
}

const userRedeemOffer = async (offer, reInitOnFail) => {
    console.log("Attempting to redeem", offer)
    if(!offer){
        return false
    }
    
    return chrome.storage.sync.set({offer: null, storeName: null}).then(() => {
        return chrome.cookies.get({url: backendBaseURL, name:"eql_user_member_key"})
        .then((cookie) => {
            if(cookie.value){
                return fetch(backendBaseURL + "api/offer-redeem?" + new URLSearchParams({
                        offerKey: offer.offer_key,
                        memberKey: cookie.value
                })).then(async (res) => {
                    console.log("Redeem offer response:", offer)

                    if((res.status == 403 || res.status == 401) && reInitOnFail){
                        initExtension().then((result) => {
                            if(result){
                                userRedeemOffer(offer, false)
                            }
                        })
                    }

                    if(res.message){
                        //This means it didn't work
                        return false
                    }else{
                        //It worked
                        return true
                    }
                })
            }else{
                return false
            }
        })
        .catch((err) => {
            console.log("User redeem error", err)
            return false
        })
    })
}

const logout = () => {
    chrome.cookies.remove({url: backendBaseURL, name:"eql_user_member_key"})
    chrome.cookies.remove({url: backendBaseURL, name:"eql_strapi_jwt"})
}

const navigationsOnDomain = {dom: "", navs: 0}
var modalMesageChange = false
const onStoreListener = (tabId, changeInfo, newTab) => { 
    const finish = async () => {
        console.log("onStoreListener: call finish")
        return readFromChromeStorage('offer').then((selectedOfferData) => {
            return readFromChromeStorage('storeName').then((selectedOfferStoreName) => {
                return getStoreName().then((currentStoreName) => {
                    if((selectedOfferData.offer && selectedOfferData.offer.code) && (selectedOfferStoreName.storeName == currentStoreName) && changeInfo.status == "complete"){
                        return chrome.scripting.executeScript({
                            target: {tabId: newTab.id},
                            func: offerCodeEntry,
                            args: [selectedOfferData.offer.code]
                        }).then((injectionResults) => {
                            return injectionResults[0].result
                        }).then((codeEntryFailed) => {
                            console.log("onStoreListener: Offer code entry res: ", codeEntryFailed)
                            if(codeEntryFailed){
                                //TODO: If this didnt work then tell the user the code is copied and to insert manually
                                statusForModal['color'] = "#1B1B1B"
                                statusForModal['message'] = `We had trouble applying your offer.<br><br>Please enter code ${selectedOfferData.offer.code} at checkout!`
                            }else{
                                statusForModal['color'] = "#0B9A70"
                                statusForModal['message'] = `Applied offer ${selectedOfferData.offer.code}. <br> Thank you for using EQL!` 
                                userRedeemOffer(selectedOfferData.offer, true)
                            }
                            return [true, codeEntryFailed]
                        })
                    }else{
                        console.log("onStoreListener: finish end (false)")
                        return false
                    }
                })
            })
        })
    }

    //TODO: Maybe a more custom approach instead chopping the whole website off
    getStoreName().then(async (domain) => {
        if(!newTab.active || newTab.url.startsWith("chrome")){
            throw "Reject -> Active:" + !newTab.active + " Chrome Tab:" + newTab.url.startsWith("chrome")
        }

        if(!newTab.url.includes(domain)){
            throw "This tab is not the store one"
        }
        
        if(navigationsOnDomain.dom == domain){
            navigationsOnDomain.navs++
        }else{
            navigationsOnDomain.dom = domain
            navigationsOnDomain.navs = 0

            chrome.storage.sync.set({offer:null, storeName:null})
        }

        if(changeInfo.status == "complete"){
            //TODO: There's no need to call the domains, we'll search on every site
            await fetch(backendBaseURL + "api/domains")
            .then((res) => {return res.json()})
            .then(async (domains) => {
                if(domains.join(' ').includes(domain)){
                    console.log("onStoreListener: found domain in domains")
                    finish().then((result) => {
                        console.log("onStoreListener: finish() result", result)
                        if(!result[0]){
                            readFromChromeStorage('offer').then((selectedOfferData) => {
                                readFromChromeStorage('storeName').then((selectedOfferStoreName) => { 
                                    if(!selectedOfferData || !selectedOfferStoreName){
                                        statusForModal['message'] = null
                                        statusForModal['color'] = "#0B9A70"
                                    }
                                })
                            })
                        }else{
                            if(result[1] != null){
                                statusForModal['message'] = null
                                statusForModal['color'] = "#0B9A70"
                            }else{
                                modalMesageChange = true
                            }
                        }
                        popModal(newTab.id)
                    })
                }
            }) 
        }

    })
    .catch((err) => {
        statusForModal['message'] = null
    })
}

const popModal = (tabId) => {
    chrome.scripting.executeScript({
        target: {tabId: tabId},
        files: ['modal.js'],
    })
}

chrome.runtime.onMessage.addListener((req,sender,sendResponse) => {
    if(req == "offers"){
        chrome.tabs.query({active: true}) 
        .then((tabs) => {
            if(tabs){
                var tab = tabs[0]
                if(tab.url.startsWith("chrome://")){
                    return null
                }else{
                    return tab.url
                }
            }
            else{
                return null
            }
        })
        .then(async (url) => {
            console.log("Frontend requested offers for", url)
            return await getOffersForUser(url)
        })
        .then((data) => {
            console.log("Getting offers: ", data)
            //CUSTOMER TOUCH POINT: They requested offers (inside data) at the domain in tab.url
            sendResponse(data)
            return true;
        })
        .catch((err) => {
            console.log("Error on getting offers", err)
            sendResponse([])
            return true;
        })
    }else if(req.email){
        console.log("Login requested from frontend", req)
        loginToEQL(req)
        .then((loggedIn) => {
            if(loggedIn){
                console.log("User is logged in!")
                sendResponse('mk')
            }else{
                console.log("User is not logged in :(")
                sendResponse(null)
            }
        }).catch((err) => {
            console.log("Error on login", err)
            sendResponse(null)
        })

        return true;
    }else if(req == 'logged in'){
        chrome.cookies.get({url: backendBaseURL, name:"eql_user_member_key"})
        .then((cookie) => {
            sendResponse(cookie != null)
        })
    }else if(req == "logout"){
        logout()
    }
    else if(req.resetEmail){
        console.log("Password reset requested from frontend")
        firebase.auth().sendPasswordResetEmail(req.resetEmail)
        .then(() => {
            sendResponse(null)
        })
        .catch((error) => {
            console.log("Error on password reset", error)
            sendResponse(1)
        });
    }else if(req == 'store name'){
        getStoreName().then((name) => {
            sendResponse(name)
        })
    }else if(req.selectedOffer){
        getStoreName().then(async (name) => {
            await chrome.storage.sync.set({offer:req.selectedOffer})
            await chrome.storage.sync.set({storeName:name})
        }).then(() => {
            return chrome.tabs.query({active: true}).then((tabs) => {return tabs[0]})
            .then((tab) => {
                return chrome.scripting.executeScript({
                    target: {tabId: tab.id},
                    func: offerCodeEntry,
                    args: [req.selectedOffer.code]
                }).then((injectionResults) => {
                    return [injectionResults[0].result, tab.id]
                })
            })
        })
        .then((result) => {
            if(result[0]){
                statusForModal['color'] = "#1B1B1B"
                statusForModal['message'] = `We had trouble applying your offer.<br><br>Please enter code ${req.selectedOffer.code} at checkout!`
                popModal(result[1])
                sendResponse({title: "Code: | copied to your clipboard!", sub:"Continue shopping while we look for the code entry."})
            }else{
                userRedeemOffer(req.selectedOffer, true)
                .then((res) => {
                    if(res){
                        statusForModal['color'] = "#0B9A70"
                        statusForModal['message'] = `Applied offer ${req.selectedOffer.code}.<br><br>Thank you for using EQL!` 
                        popModal(result[1])
                        sendResponse({title: "Offer applied successfully!", sub:"Code: | copied to your clipboard just in case."})
                    }
                    else{
                        statusForModal['color'] = "#1B1B1B"
                        statusForModal['message'] = `We had trouble applying your offer.<br><br>Please enter code ${req.selectedOffer.code} at checkout!`
                        popModal(result[1])
                        sendResponse({title: "Code: | copied to your clipboard!", sub:"Please paste code in the coupon code entry."})
                    }
                })
            }
        })
        .catch((error) => {
            sendResponse({title: "Error on code application.", sub:"Code: | copied to your clipboard."})
        });

    }else if(req == "status for modal"){
        console.log("Status for modal requested from frontend")
        sendResponse(statusForModal)
    }
    
    return true;
})


chrome.history.onVisited.addListener(
    function(result){
        
    }
)
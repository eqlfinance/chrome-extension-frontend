var statusForModal = {color: null, message: null}
var taken_coupon_code = false
const backendBaseURL =  "https://eql-extension-backend.herokuapp.com/" 

self.importScripts(chrome.runtime.getURL("res/firebase-compat.js"));

const initExtension = async () => {
    return fetch(backendBaseURL + 'api/init-extension')
    .then((res) => {return res.json()})
    .then((res) => {
        
        return chrome.cookies.set({httpOnly: true, secure: true, url: backendBaseURL, name:"eql_strapi_jwt", value: res.jwt})
        .then((cookie) => {
            if(!chrome.runtime.lastError){
                const app = firebase.initializeApp(res.config);
                var defaultAuth = firebase.auth();
                return true
            }else{
                console.log(chrome.runtime.lastError)
                return false
            }
        })

    })
    .catch((err) => {
        console.log("Error on init extension", err)
        return false
    })
}


chrome.runtime.onInstalled.addListener((details) => {
    initExtension().then((result) => {
        if(result){
            chrome.tabs.onUpdated.addListener(onStoreListener)
    
            chrome.tabs.create({
                url: chrome.runtime.getURL('post-download-upgrade.html')
            })
        }else{
            //The server is down or something catastrophic
        }
        
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
    return chrome.cookies.get({url: backendBaseURL, name:"eql_user_member_key"}).then((cookie) => {
        if(!cookie){
            return initExtension()
        }

        return cookie
    }).then((cookie) => {
        if(!cookie){
            throw "Unreachable unless the server down"
        }

        return null
    }).then(() => {
        return chrome.cookies.get({url: backendBaseURL, name:"eql_user_member_key"})
    })
    .then((cookie) => {
        if(cookie && cookie.value){
            return true
        }else{
            return firebase.auth().signInWithEmailAndPassword(userDetails.email, userDetails.password)
            .then((userCredential) => {
                // Signed in
                var user = userCredential.user;
                return user
            })
            .then(async (user) => {
                if(user){
                    return user.getIdToken(true).then((token) => {
                        return token
                    })
                }else{
                    return null
                }
            }).then((token) => {
                if(!token){
                    return null
                }else{
                    return chrome.cookies.set({httpOnly: true, secure: true, url: backendBaseURL, name:"eql_firebase_id", value: token})
                    .then((cookie) =>{
                        return fetch(backendBaseURL + "api/eql-login")
                        .then((res) => {
                            return res.json()
                        }).catch((err) => {
                            return null
                        })
                    })
                }
            }).then(async (json) => {
                if(json && json.access_token){
                    await chrome.cookies.remove({url: backendBaseURL, name:"eql_firebase_id"})
                    let user_member_key = json.user_id.split('-').join('').toLowerCase()

                    return chrome.cookies.set({httpOnly: true, secure: true, url: backendBaseURL, name:"eql_user_member_key", value: user_member_key})
                        .then((cookie) => {
                            if(chrome.runtime.lastError){
                                return false
                            }else{
                                return true
                            }
                        })
                }else{
                    throw json
                }
            })
            .catch((error) => {
                var errorCode = error.code;
                var errorMessage = error.message;

                console.log(error)
                return false
            });
        }
    })
}

const searchAPIRequest = async (url) => {
    return chrome.cookies.get({url: backendBaseURL, name:"eql_strapi_jwt"}).then((cookie) => {
        if(!cookie){
            return initExtension()
        }

        return cookie
    }).then((cookie) => {
        if(!cookie){
            throw "Unreachable unless the server down searchAPIRequset"
        }

        return null
    }).then(() => {
        if(!url){
            return []
        }else{
            return fetch(backendBaseURL + "api/domains?search=" + url)
            .then((res) => {
                if(res.status == 403 || res.status == 401){
                    console.log("Status code 403, rerunning")
                    initExtension().then((result) => {
                        if(result){
                            return searchAPIRequest(url)
                        }else{
                            return []
                        }
                    })
                }

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
        return chrome.cookies.get({url: backendBaseURL, name:"eql_strapi_jwt"}).then((cookie) => {
            if(!cookie){
                return initExtension()
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
        return 1
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
            return 2
        }
    }

    return null
}

const userRedeemOffer = async (offer, reInitOnFail) => {
    
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
            await fetch(backendBaseURL + "api/domains")
            .then((res) => {return res.json()})
            .then(async (domains) => {
                if(domains.join(' ').includes(domain)){
                    finish().then((result) => {
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
        loginToEQL(req)
        .then((loggedIn) => {
            if(loggedIn){
                sendResponse('mk')
            }else{
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
        firebase.auth().sendPasswordResetEmail(req.resetEmail)
        .then(() => {
            sendResponse(null)
        })
        .catch((error) => {

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
        sendResponse(statusForModal)
    }
    
    return true;
})


chrome.history.onVisited.addListener(
    function(result){
        
    }
)
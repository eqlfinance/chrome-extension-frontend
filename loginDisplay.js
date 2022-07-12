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

chrome.runtime.sendMessage('logged in', (response) => {
    if(response){
        chrome.runtime.sendMessage({state: "logged in"}, (res) => {
            window.close()
        })
    }
})

document.querySelector('#eql-login-form').addEventListener('submit', (e) => {
    console.log(e)
    //CUSTOMER TOUCH POINT: They logged in to EQL from the popup login form        
    let email = document.getElementById('eql-login-form').elements['email'].value
    let password = document.getElementById('eql-login-form').elements['password'].value

    chrome.runtime.sendMessage({email:email, password:password}, (response) => {
        if(response === 'mk'){
            document.getElementsByClassName('eql-incorrect')[0].style.display = 'none'
            document.getElementById('password-entry').style.borderColor = "#BDBDBE"
            document.getElementById('pwText').style.color = "#3D3E3F"

            chrome.runtime.sendMessage({state: "logged in"})
        }else{
            document.getElementsByClassName('eql-incorrect')[0].style.display = 'block'
            document.getElementById('password-entry').style.borderColor = "#c51717"
            document.getElementById('pwText').style.color = "#c51717"
        }
    })

    e.preventDefault()
})

document.querySelector("#email-entry").onclick = (ev) => {
    ev.target.querySelector(".input")?.focus()
}
document.querySelector("#password-entry").onclick = (ev) => {
    ev.target.querySelector(".input")?.focus()
}
document.getElementById("forgot")?.addEventListener('click', () => {
    chrome.runtime.sendMessage({state: "forgot password"})
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
document.getElementById("close")?.addEventListener('click', () => {
    window.close()
})
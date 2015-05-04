$(document).ready(function(){
    $('#mainhead').css('margin-top', (($( document ).height()/2) - 250) + 'px');
    if($( document ).height()/2 <= 200) {
        $('#mainhead').css('margin-top', '10px');
    }
    if(getCookie('slide') == 1){
        $("#slide").slideToggle();
    }
    $(function(){
        $("#slides").slidesjs({
            width: 500,
            height: 30,
            navigation: {
                active: false,
                effect: "fade"
            },
            pagination: {
                active: false
            }
        });
    });
});

function getCookie(cname) {
    var name = cname + "=";
    var ca = document.cookie.split(';');
    for(var i=0; i<ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0)==' ') c = c.substring(1);
        if (c.indexOf(name) == 0) return c.substring(name.length,c.length);
    }
    return "";
}

function setCookie(cname, cvalue, exdays) {
    var d = new Date();
    d.setTime(d.getTime() + (exdays*24*60*60*1000));
    var expires = "expires="+d.toUTCString();
    document.cookie = cname + "=" + cvalue + "; " + expires;
}

$("#clicktopic").click(function(){
    if(getCookie('slide') == 0) {
        $("#slide").slideToggle();
        setCookie('slide', 1, 1);
    }
    $("#slide").slideToggle();
});

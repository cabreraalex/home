$(document).ready(function(){
    $('#mainhead').css('margin-top', (($( document ).height()/2) - 250) + 'px');
    if($( document ).height()/2 <= 200) {
        $('#mainhead').css('margin-top', '10px');
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

$("#clicktopic").click(function(){
    $("#slide").slideToggle();
});

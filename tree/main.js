var canvas = document.getElementById("canvas");
var context = canvas.getContext("2d");

var LENGTH = 100;
var T_ITER = 10;
var ANGLE = Math.PI/8;

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

context.beginPath();
context.rect(0, 0, canvas.width, canvas.height);
context.fillStyle = "#000000";
context.fill();

context.beginPath();
context.moveTo(canvas.width/2, canvas.height-100);
context.lineTo(canvas.width/2, canvas.height-(100+LENGTH));
context.lineWidth = 5;
context.strokeStyle = "#ffffff";
context.stroke();

branch(canvas.width/2, canvas.height-(100+LENGTH), 1);

function branch(x, y, iter) {
    if(iter == T_ITER) {
        return;
    }
    LENGTH = 3*LENGTH/4;
    context.beginPath();
    context.moveTo(x, y);
    var xf = LENGTH*Math.cos(ANGLE);
    var yf = LENGTH*Math.sin(ANGLE);
    context.lineTo(x+xf, y-yf);
    context.strokeStyle = "#ffffff";
    context.stroke();
    branch(x+xf, y-yf, iter++);

    context.beginPath();
    context.moveTo(x, y);
    var xf = -xf
    context.lineTo(x+xf, y-yf);
    context.strokeStyle = "#ffffff";
    context.stroke();
    branch(x+xf, y-yf, iter++);
}

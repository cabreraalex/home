var canvas = document.getElementById("canvas");
var context = canvas.getContext("2d");

canvas.height = window.innerHeight-55;
canvas.width = window.innerWidth;

var wheight = canvas.height;
var wwidth = canvas.width;

context.beginPath();
context.rect(0, 0, wwidth, wheight);
context.fillStyle = '#000000';
context.fill();

var rgb = [255, 255, 255, 2];
var side = 1;
var x = wwidth/2;
var y = wheight/2;
var angle;

function drawLine(angle) {
  context.beginPath();
  context.moveTo(x, y);
  x = x + Math.round(Math.cos(angle))*side;
  y = y + Math.round(Math.sin(angle))*side;
  context.lineTo(x, y);
  if(rgb[rgb[3]]-1<0){
    rgb[3]--;
    if(rgb[3]<0){
      rgb[3]=2;
      rgb[0]=255;
      rgb[1]=255;
      rgb[2]=255;
    }
  }
  rgb[rgb[3]] -= 1;
  context.strokeStyle = 'rgb(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] +')';
  context.stroke();
}

function dragon(iter){
  context.beginPath();
  context.rect(0, 0, wwidth, wheight);
  context.fillStyle = '#000000';
  context.fill();
  angle = (Math.PI/2);
  var times = 0;
  while(times != iter){
    drawLine(angle);
    var bla = times & -times;
    if((bla << 1) & times){
      angle+=Math.PI/2;
    }
    else{
      angle -= Math.PI/2;
    }
    side = 500 / Math.sqrt(iter);
    times++;
  }
  x = wwidth/2;
  y = wheight/2;
}

dragon(100000);

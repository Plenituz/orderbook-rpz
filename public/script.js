window.addEventListener('load', init);
let candleTime = 2;//in minutes

function maxNamedArr(arr){
  let m = parseFloat(arr[0]);
  for(v in arr){
    v = parseFloat(v);
    if(v > m)
      m = v;
  }
  return m;
}

function maxPrice(data){
  return Math.max(...data.map(d => d.Price));
}

function minPrice(data){
  return Math.min(...data.map(d => d.Price));
}

function maxCandle(processed){
  return Math.max(...Object.keys(processed));
}

function init(){
  $.ajax({
      url: document.location.origin + "/data",
      type: 'GET',
      error: function(err){
          console.log("error:");
          console.log(err);
      },
      success: function (data) {
        //data should be sorted most recent to oldest
        data.reverse();
        var processed = {};
        
        //groupe per time frame
        var startTime = Date.parse(data[0].TimeStamp);
        for(let i = 0; i < data.length; i++){
          var time = Date.parse(data[i].TimeStamp);
          var delta = time - startTime;
          var deltaMinutes = delta/(1000*60);
          var mod = deltaMinutes / candleTime;
          var candle = Math.floor(mod);
          
          if(!(candle in processed)){
            processed[candle] = [];
          }
          processed[candle].push(data[i]);
         // console.log(deltaMinutes, mod, candle, data[i].TimeStamp);
        }

        //group per price
        for(prop in processed){
          let dataPoint = processed[prop];
          var arr = {};

          for(let i = 0; i < dataPoint.length; i++){
            let entry = dataPoint[i];
            if(!(entry.Price in arr)){
              arr[entry.Price] = []; 
            }
            arr[entry.Price].push(entry);
          }
          processed[prop] = arr;
        }

        var bounds = new SimpleRect(0, maxCandle(processed), minPrice(data), maxPrice(data));
        

        console.log("processed:", processed);
        console.log("bounds:", bounds);

        draw(processed, bounds);
      }
  });
}

function draw(data, bounds){
  console.log(data);
  var volumes = [];
  var points = [];
  var colors = [];

  for(candleNb in data){
    let candleGroup = data[candleNb];
    for(price in candleGroup){
      let entryGroup = candleGroup[price];
      let point = new Point(candleNb, price);
      //console.log(point);
      point = transformPoint(new Point(candleNb, price), bounds, $('canvas').width(), $('canvas').height());
      var volume = entryGroup.map(f => f.Quantity).reduce((prev, next) => prev + next);
      point.y *= -1;
      volumes.push(volume);
      points.push(point);
      console.log(entryGroup);//faire un degradé entre rouge/vert en fonction du volume d'achat vs volume de vente
      colors.push(entryGroup.OrderType == "SELL" ? 'red' : 'green');
     // console.log((candleNb*candleTime) + ":" + price + ":", entryGroup);
      //candleNb is X, price is Y
    }
  }

  volumes = normalizeArray(volumes);
  volumes = volumes.map(v => v < .1 ? .1 : v);

  for(let i = 0; i < volumes.length; i++){
    $('canvas').drawArc({
      x: points[i].x, y: points[i].y,
      radius: volumes[i]*50,
      fillStyle: colors[i]
    });
  }
}

function normalizeArray(arr){
  var max = Math.max(...arr);
  var min = Math.min(...arr);

  return arr.map(r => (r-min)/max);
}

function transformPoint(inPoint, bounds, actualWidth, actualHeight)
{
    //these are the "canvas space" limit
    //basically drawing a square in keyframe space and rendering inside it

    var width = Math.abs(bounds.right - bounds.left);
    var height = Math.abs(bounds.top - bounds.bottom);

    //move the point to fit pos in frame
    //give the position from the border of the frame in percent
    var percentY = (inPoint.y - bounds.bottom) / height;
    var percentX = (inPoint.x - bounds.left) / width;   

    //then multiply the distance in percent by the size of the canvas to get the position 
    //on the canvas
    var moved = new Point(actualWidth * percentX, actualHeight * percentY);
    return moved;
}

function reverseTransformPoint(inPoint, bounds, actualWidth, actualHeight)
{
    var width = Math.abs(bounds.right - bounds.left);
    var height = Math.abs(bounds.top - bounds.bottom);

    var percentX = inPoint.x / actualWidth;
    var percentY = inPoint.y / actualHeight;
    percentX *= width;
    percentY *= height;
    percentX += bounds.left;
    percentY += bounds.bottom;

    return new Point(percentX, percentY);
}

function SimpleRect(left, right, top, bottom){
  this.left = left;
  this.right = right;
  this.top = top;
  this.bottom = bottom;
}

function Point(x, y){
  this.x = x;
  this.y = y;
}
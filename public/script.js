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

var dataHandler = (function(){

  return {
    //takes in an order book and return an object that has indexes like a list 
    //each index property will have a list of all the orders that arrived during that candlestick
    //the orderbook data don't have to be sorted 
    groupOrderBookPerCandle: function(candleTime, data){
      var processed = {};
      processed.length = 0;
      //groupe per time frame
      //startTime is the smallest time of all the orderbook provided
      var startTime = Math.min(...data.map(d => Date.parse(d.TimeStamp)));

      for(let i = 0; i < data.length; i++){
        var time = Date.parse(data[i].TimeStamp);
        var deltaMinutes = (time - startTime)/(1000*60);
        var candle = Math.floor(deltaMinutes / candleTime);

        
        if(!(candle in processed)){
          processed[candle] = [];
          processed.length++;
        }
        processed[candle].push(data[i]);
       // console.log(deltaMinutes, mod, candle, data[i].TimeStamp);
      }
      return processed;
    }, 

    //takes in data processed by groupOrderBookPerCandle and for each candle 
    //group all the orders of with the same price together in an array under a property whose name is the price
    groupCandlesPerPrice: function(processed){
      //group per price
      for(let i = 0; i < processed.length; i++){
        let candle = processed[i];
        var priceGroups = {};

        for(let i = 0; i < candle.length; i++){
          let order = candle[i];
          
          if(!(order.Price in priceGroups))
            priceGroups[order.Price] = []; 
          
          priceGroups[order.Price].push(order);
        }
        processed[i] = priceGroups;
      }
      return processed;
    },

    groupOrderBookPerPrice: function(data){
      //PER PRICE AND EXACT TIME
      groups = {};

      for(let i = 0; i < data.length; i++){
        var order = data[i];
        if(!(order.Price in groups))
          groups[order.Price] = [];
        groups[order.Price].push(order);
      }
      return groups;
    },

    replacePriceGroupByDataPoint: function(priceGroups){
      
    }
  };
})();

function init(){
  $.ajax({
      url: document.location.origin + "/data",
      type: 'GET',
      error: function(err){
          console.log("error:");
          console.log(err);
      },
      success: function (data) {
        
        var processed = dataHandler.groupOrderBookPerCandle(candleTime, data);
        console.log("percandle:", Object.assign({}, processed));
        dataHandler.groupCandlesPerPrice(processed);
     //   console.log(dataHandler.groupOrderBookPerPrice(data));

        var bounds = new SimpleRect(
          0, 
          processed.length,
          Math.min(...data.map(d => d.Price)),//minimum of all prices
          Math.max(...data.map(d => d.Price)));//maximum of all prices
        

        console.log("processed:", processed);
        console.log("bounds:", bounds);

        draw(processed, bounds);
      }
  });
}

function draw(data, bounds){
  var volumes = [];
  var prices = [];
  var points = [];
  var colors = [];

  for(candleNb in data){
    let candleGroup = data[candleNb];
    for(price in candleGroup){
      let entryGroup = candleGroup[price];
      let point = new Point(candleNb, price);
      point = transformPoint(new Point(candleNb, price), bounds, $('canvas').width(), $('canvas').height());
      var volume = entryGroup.map(f => f.Quantity).reduce((prev, next) => prev + next);

      var color;
      var sellVolume = entryGroup.filter(f => f.OrderType == "SELL").map(f => f.Quantity);
      if(sellVolume.length != 0){
        sellVolume = sellVolume.reduce((p, n)=> p + n);
        var percentSell = sellVolume / volume;
        color = lerpColor('#53B987', '#EB4D5C', percentSell);
      }else{
        color = '#53B987';
      }
      


      point.y *= -1;
      prices.push(price);
      volumes.push(volume);
      points.push(point);
      
     // console.log(entryGroup);//faire un degradé entre rouge/vert en fonction du volume d'achat vs volume de vente
      colors.push(color);
     // console.log((candleNb*candleTime) + ":" + price + ":", entryGroup);
      //candleNb is X, price is Y
    }
  }
  //TODO put smaller dots on top 

  var normalizedVolumes = normalizeArray(volumes);
  normalizedVolumes = normalizedVolumes.map(v => v < .1 ? .1 : v);

  for(let i = 0; i < volumes.length; i++){
    $('canvas').drawArc({
      layer: true,
      x: points[i].x, y: points[i].y,
      radius: normalizedVolumes[i]*50,
      fillStyle: colors[i],
      data: {
        volume: volumes[i],
        price: prices[i], 
        baseRadius: normalizedVolumes[i]*50
      },
      mouseover: function(layer){
        console.log(layer)
        $(this).animateLayer(layer, {
          radius: layer.data.baseRadius*1.2,
          opacity: .5
        }, 50);
      },
      mouseout: function(layer){
        $(this).animateLayer(layer, {
          radius: layer.data.baseRadius,
          opacity: 1
        }, 50);
      }
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

function lerpColor(a, b, amount) {
  var ah = parseInt(a.replace(/#/g, ''), 16),
      ar = ah >> 16, ag = ah >> 8 & 0xff, ab = ah & 0xff,
      bh = parseInt(b.replace(/#/g, ''), 16),
      br = bh >> 16, bg = bh >> 8 & 0xff, bb = bh & 0xff,
      rr = ar + amount * (br - ar),
      rg = ag + amount * (bg - ag),
      rb = ab + amount * (bb - ab);

  return '#' + ((1 << 24) + (rr << 16) + (rg << 8) + rb | 0).toString(16).slice(1);
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
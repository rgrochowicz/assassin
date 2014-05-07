


var w = 800,
    h = 800,
    rx = w / 2,
    ry = h / 2,
    m0,
    rotate = 0;

var splines = [];

var cluster = d3.layout.cluster()
    .size([360, ry - 120])
    .sort(function(a, b) { return d3.ascending(a.key, b.key); });

var bundle = d3.layout.bundle();

var line = d3.svg.line.radial()
    .interpolate("bundle")
    .tension(.85)
    .radius(function(d) { return d.y; })
    .angle(function(d) { return d.x / 180 * Math.PI; });

// Chrome 15 bug: <http://code.google.com/p/chromium/issues/detail?id=98951>
var div = d3.select(".svg-art").append("div")
    .style("width", "100%")
    .style("height", "100%")
    .style("-webkit-backface-visibility", "hidden");

var svg = div.append("svg:svg")
    .attr("width", "100%")
    .attr("height", "100%")
    .attr("viewBox", "0 0 " + (w) + " " + (h))
    .attr("preserveAspectRatio", "xMidYMid")
  .append("svg:g")
    .attr("transform", "translate(" + rx + "," + ry + ")");

svg.append("svg:path")
    .attr("class", "arc")
    .attr("d", d3.svg.arc().outerRadius(ry - 120).innerRadius(0).startAngle(0).endAngle(2 * Math.PI))


d3.json("/public/team", function(teams) {
  teams = teams.objects;
  d3.json("/public/death", function(deaths) {
    deaths = deaths.objects;
    var map = {parent:null, children:[]};
    teams.forEach(function(e, i) {

      var members = e.members.map(function(mE,mI) { return {id: mE.id, name: mE.name, killers: [], kills: [], team: e, children: [], parent: null}; });

      map.children.push({
        name: e.name,
        children: members,
        parent: map
      });
    });
    var nodes = cluster.nodes(map);

    var links = [];
    deaths.forEach(function(e, i) {
      e.killers.forEach(function(killer) {
        e.targets.forEach(function(target) {
          var killerNode = _.findWhere(nodes, {id: killer.id});
          var targetNode = _.findWhere(nodes, {id: target.id})
          killerNode.kills.push(targetNode);
          targetNode.killers.push(killerNode);
          links.push({source: targetNode, target: killerNode});
        });
      });
    });

    var recentDeaths = _.chain(deaths).sortBy(function(e){return e.id}).last(6).reverse().map(function(e) {
      var date = new Date(e.date);
      var datestr = (date.getMonth()+1) + "/" + date.getDate() + "/" + date.getFullYear();
      return _(e.killers).pluck('name').join(', ') + ' killed ' + _(e.targets).pluck('name').join(', ') + ' on ' + datestr;
    }).value();

    recentDeaths.forEach(function(e) {
      $("<div class='col-md-4'></div>").append(
        $("<p class='bg-info'></p>").text(e)
      ).appendTo('#recent-deaths');
    });


    //get stats
    var sortedByKills = _.chain(nodes).filter(function(e){return e.killers;}).sortBy(function(e) { return e.kills.length }).value();

    _.first(sortedByKills, 5).forEach(function(e) {
      var numKills = e.kills.length;
      $('#bottom-table').append($('<tr></tr>').append($('<td></td>').text(e.name)).append($('<td></td>').text(numKills)));
    });

    _.chain(sortedByKills).last(5).reverse().value().forEach(function(e) {
      var numKills = e.kills.length;
      $('#top-table').append($('<tr></tr>').append($('<td></td>').text(e.name)).append($('<td></td>').text(numKills)));
    });

    teams.forEach(function(e, i) {
      $("<div class='col-md-6'></div>").append(
        $("<table class='table'></table>").append(
          $('<tr></tr>').append(
            $('<th></th>').text(e.name)
          )
        ).append(e.members.map(function(mE) {
          var ele = $("<tr></tr>").append(
            $("<td></td>").text(mE.name)
          )
          if(_.findWhere(sortedByKills, {id: mE.id}).killers.length) {
            ele.addClass('danger');
          } else {
            ele.addClass('success');
          }
          return ele;
        }))
      ).appendTo('#teams-part')
    })

    var numDead = _.filter(sortedByKills, function(e){return e.killers.length;}).length;
    var numAlive = sortedByKills.length - numDead;

    var groupedByTeam = _.groupBy(sortedByKills, function(e) {
      return e.team.id;
    });

    var counts = _.chain(groupedByTeam).pairs().map(function(e) { return _(e[1]).filter(function(eM) {return eM.killers.length; }).length; }).map(function(e) { return 4-e; }).countBy(function(e){return e;}).value();

    drawMemberGraph(numAlive, numDead);
    drawTeamGraph(counts);

    var splines = bundle(links);
    var path = svg.selectAll("path.link")
      .data(links)
    .enter().append("svg:path")
      .attr("class", function(d) { return "link source-" + d.source.id + " target-" + d.target.id; })
      .attr("marker-start", "url(#arrow)")
      .attr("d", function(d, i) { return line(splines[i]); });

    svg.append("defs").append("marker")
      .attr("id", "arrow")
      .attr("viewBox", "0 -5 10 10")
      .attr("markerWidth", 2)
      .attr("markerHeight", 2)
      .attr("refX", 2.1)
      .attr("orient", "auto")
    .append("path")
      .attr("d", "M10,-5L0,0L10,5");

    var nodegroup = svg.selectAll("g.node")
        .data(nodes.filter(function(n) { return !n.children; }))
      .enter().append("svg:g")
        .attr("class", "node")
        .attr("id", function(d) { return "node-" + d.id; })
        .attr("transform", function(d) { return "rotate(" + (d.x - 90) + ")translate(" + d.y + ")"; });

    var labelgroup = svg.selectAll("g.team-label")
        .data(nodes.filter(function(n) { return n.children; }))
      .enter().append("svg:g")
        .attr("class", "team-label")
        .attr("transform", function(d) { return "rotate(" + (d.x - 90) + ")translate(" + d.y + ")"; });
      
    nodegroup.append("svg:text")
      .attr("dx", function(d) { return d.x < 180 ? 8 : -8; })
      .attr("dy", ".1em")
      .attr("text-anchor", function(d) { return d.x < 180 ? "start" : "end"; })
      .attr("transform", function(d) { return d.x < 180 ? null : "rotate(180)"; })
      .attr("text-decoration", function(d) { return (d.killers && d.killers.length) ? "line-through" : null})
      .text(function(d) { return (d.killers && d.killers.length) ? d.name + " \u2620" : d.name; })
      .on("mouseover", mouseover)
      .on("mouseout", mouseout)

    labelgroup.append("svg:text")
      .attr("dx", function(d) { return d.x < 180 ? 0 : 0; })
      .attr("dy", ".1em")
      .attr("text-anchor", function(d) { return d.x < 180 ? "start" : "end"; })
      .attr("transform", function(d) { return d.x < 180 ? null : "rotate(180)"; })
      .text(function(d) { return d.name })

    $("body").addClass('done');

  });
});

function mouse(e) {
  return [e.pageX - rx, e.pageY - ry];
}


function mouseover(d) {
  svg.selectAll("path.link.target-" + d.id)
      .classed("target", true)
      .each(updateNodes("source", true));

  svg.selectAll("path.link.source-" + d.id)
      .classed("source", true)
      .each(updateNodes("target", true));
}

function mouseout(d) {
  svg.selectAll("path.link.source-" + d.id)
      .classed("source", false)
      .each(updateNodes("target", false));

  svg.selectAll("path.link.target-" + d.id)
      .classed("target", false)
      .each(updateNodes("source", false));
}

function updateNodes(name, value) {
  return function(d) {
    if (value) this.parentNode.appendChild(this);
    svg.select("#node-" + d[name].id).classed(name, value);
  };
}

function cross(a, b) {
  return a[0] * b[1] - a[1] * b[0];
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1];
}

function drawMemberGraph(numAlive, numDead) {
  var data = [
    {
      label: "Alive",
      frequency: numAlive
    },
    {
      label: "Dead",
      frequency: numDead
    }
  ]

  var margin = {top: 20, right: 20, bottom: 30, left: 40},
      width = 960 - margin.left - margin.right,
      height = 500 - margin.top - margin.bottom;

  var x = d3.scale.ordinal()
      .rangeRoundBands([0, width], .1);

  var y = d3.scale.linear()
      .range([height, 0]);

  var xAxis = d3.svg.axis()
      .scale(x)
      .orient("bottom");

  var yAxis = d3.svg.axis()
      .scale(y)
      .orient("left")
      .ticks(10);

  var svg = d3.select("#member-graph").append("svg")
      .attr("width", "100%")
      .attr("height", "100%")
      .attr("viewBox", "0 0 " + (width + margin.left + margin.right) + " " + (height + margin.top + margin.bottom))
      .attr("preserveAspectRatio", "xMidYMid")
    .append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  x.domain(["Dead", "Alive"]);
  y.domain([0, d3.max(data, function(d) { return d.frequency; })]);

  svg.append("g")
      .attr("class", "x axis")
      .attr("transform", "translate(0," + height + ")")
      .call(xAxis);

  svg.append("g")
      .attr("class", "y axis")
      .call(yAxis)
    .append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", 6)
      .attr("dy", ".71em")
      .style("text-anchor", "end")
      .text("Frequency");

  svg.selectAll(".bar")
      .data(data)
    .enter().append("rect")
      .attr("class", "bar")
      .attr("x", function(d) { return x(d.label); })
      .attr("width", x.rangeBand())
      .attr("y", function(d) { return y(d.frequency); })
      .attr("height", function(d) { return height - y(d.frequency); });


}

function drawTeamGraph(counts) {
  var data = [
    {
      label: "0",
      frequency: 0
    },
    {
      label: "1",
      frequency: 0
    },
    {
      label: "2",
      frequency: 0
    },
    {
      label: "3",
      frequency: 0
    },
    {
      label: "4",
      frequency: 0
    }
  ];
  _.each(counts, function(e, i) {
    _.findWhere(data, {label: i}).frequency = e;
  });

  var margin = {top: 20, right: 20, bottom: 30, left: 40},
      width = 960 - margin.left - margin.right,
      height = 500 - margin.top - margin.bottom;

  var x = d3.scale.ordinal()
      .rangeRoundBands([0, width], .1);

  var y = d3.scale.linear()
      .range([height, 0]);

  var xAxis = d3.svg.axis()
      .scale(x)
      .orient("bottom");

  var yAxis = d3.svg.axis()
      .scale(y)
      .orient("left")
      .ticks(2);

  var svg = d3.select("#team-graph").append("svg")
      .attr("width", "100%")
      .attr("height", "100%")
      .attr("viewBox", "0 0 " + (width + margin.left + margin.right) + " " + (height + margin.top + margin.bottom))
      .attr("preserveAspectRatio", "xMidYMid")
    .append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  x.domain(data.map(function(d) { return d.label; }));
  y.domain([0, d3.max(data, function(d) { return d.frequency; })]);

  svg.append("g")
      .attr("class", "x axis")
      .attr("transform", "translate(0," + height + ")")
      .call(xAxis);

  svg.append("g")
      .attr("class", "y axis")
      .call(yAxis)
    .append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", 6)
      .attr("dy", ".71em")
      .style("text-anchor", "end")
      .text("Frequency");

  svg.selectAll(".bar")
      .data(data)
    .enter().append("rect")
      .attr("class", "bar")
      .attr("x", function(d) { return x(d.label); })
      .attr("width", x.rangeBand())
      .attr("y", function(d) { return y(d.frequency); })
      .attr("height", function(d) { return height - y(d.frequency); });



}

var app = angular.module('assassinApp', [
	'ngResource',
	'mgcrea.ngStrap',
	'assassinAppControllers',
	'timer',
	'cgBusy',
	'ngSanitize'
]);

function getSerialize (fn, decycle) {
  var seen = [], keys = [];
  decycle = decycle || function(key, value) {
    return '[Circular ' + getPath(value, seen, keys) + ']'
  };
  return function(key, value) {
    var ret = value;
    if (typeof value === 'object' && value) {
      if (seen.indexOf(value) !== -1)
        ret = decycle(key, value);
      else {
        seen.push(value);
        keys.push(key);
      }
    }
    if (fn) ret = fn(key, ret);
    return ret;
  }
}

function getPath (value, seen, keys) {
  var index = seen.indexOf(value);
  var path = [ keys[index] ];
  for (index--; index >= 0; index--) {
    if (seen[index][ path[0] ] === value) {
      value = seen[index];
      path.unshift(keys[index]);
    }
  }
  return '~' + path.join('.');
}

var stringify = _.memoize(function (obj, fn, spaces, decycle) {
  return JSON.stringify(obj, getSerialize(fn, decycle), spaces);
})

//returns a map with the id as a key and the object as the value
function idLookup(arr) {
	var result = {};
	_(arr).forEach(function(entry) {
		result[entry.id] = entry;
	})
	return result;
}

_.mixin({ 'idLookup': idLookup });


app.factory('Resources', ['$resource', function($resource) {
	var Member = $resource('/public/member/:id', {id:'@id'}, {
		query: {
			isArray: true,
			transformResponse: function(data, headersGetter) {
				return JSON.parse(data).objects;
			}
		},
	});
	var Team = $resource('/public/team/:id', {id:'@id'}, {
		query: {
			isArray: true,
			transformResponse: function(data, headersGetter) {
				var objs = JSON.parse(data).objects;
				objs.forEach(function(e, i) {
					e.members.forEach(function(mE, mI) {
						e.members[mI] = new Member(mE);
					});
				});
				return objs;
			}
		}
	});
	var Round = $resource('/public/round/:id', {id:'@id'}, {
		query: {
			isArray: true,
			transformResponse: function(data, headersGetter) {
				var objs = JSON.parse(data).objects;
				objs.forEach(function(e, i) {
					e.teams.forEach(function(mE, mI) {
						e.teams[mI] = new Team(mE);
					});
					e.end_time_parsed = Date.parse(e.end_time);
				});
				return objs;
			}
		},
		update: {method: 'PUT', headers: {'Content-Type': 'application/json'}}
	});
	var Death = $resource('/public/death/:id', {id:'@id'}, {
		query: {
			isArray: true,
			transformResponse: function(data, headersGetter) {
				var objs = JSON.parse(data).objects;
				return objs;
			}
		},
	});
	return {
		Member: Member,
		Team: Team,
		Round: Round,
		Death: Death
	}
}]);

app.factory('Graphs', [function() {

	var memberHealth = function(numAlive, numDead) {
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

		var Y_DATA_FORMAT = d3.format("");

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

		d3.select("#member-graph svg").remove();

		var svg = d3.select("#member-graph").append("svg")
		  .attr("width", "100%")
		  .attr("height", "100%")
		  .attr("viewBox", "0 0 " + (width + margin.left + margin.right) + " " + (height + margin.top + margin.bottom))
		  .attr("preserveAspectRatio", "xMidYMid")
		.append("g")
		  .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

		x.domain(_(data).pluck('label').value());
		y.domain([0, d3.max(data, function(d) { return d.frequency; })]);

		var detailBox = svg.append("svg:text")
		  .attr("dx", "20px")
		  .attr("dy", "-5px")
		  .attr("text-anchor", "right")
		  .style("fill", "#1D5096")
		  .style("font-weight", "bold")
		  .style("font-size", "24px");

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
		  .attr("height", function(d) { return height - y(d.frequency); })
		  .on("mouseover", function(d, i, j) {
	        detailBox.attr("x", x.range()[i] - Y_DATA_FORMAT(d.frequency).length / 2)
	          .attr("y", y(d.frequency))
	          .text(Y_DATA_FORMAT(d.frequency))
	          .style("visibility", "visible");
	      
	        d3.select(this)
	          .style("opacity", 0.7);
	      }).on("mouseout", function() {
	        detailBox.style("visibility", "hidden");
	        
	        d3.select(this)
	          .style("opacity", 1.0);
	      });
	}

	var teamMembersRemaining = function(counts) {
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

		_(counts).forOwn(function(count, countKey) {
			_.find(data, { label: countKey }).frequency = count;
		});

		var margin = {top: 20, right: 20, bottom: 30, left: 40},
		  width = 960 - margin.left - margin.right,
		  height = 500 - margin.top - margin.bottom;

		var Y_DATA_FORMAT = d3.format("");

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

		d3.select("#team-graph svg").remove();

		var svg = d3.select("#team-graph").append("svg")
		  .attr("width", "100%")
		  .attr("height", "100%")
		  .attr("viewBox", "0 0 " + (width + margin.left + margin.right) + " " + (height + margin.top + margin.bottom))
		  .attr("preserveAspectRatio", "xMidYMid")
		.append("g")
		  .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

		x.domain(data.map(function(d) { return d.label; }));
		y.domain([0, d3.max(data, function(d) { return d.frequency; })]);

		var detailBox = svg.append("svg:text")
		  .attr("dx", "20px")
		  .attr("dy", "-5px")
		  .attr("text-anchor", "right")
		  .style("fill", "#1D5096")
		  .style("font-weight", "bold")
		  .style("font-size", "24px");

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
		  .attr("height", function(d) { return height - y(d.frequency); })
		.on("mouseover", function(d, i, j) {
	        detailBox.attr("x", x.range()[i] - Y_DATA_FORMAT(d.frequency).length / 2)
	          .attr("y", y(d.frequency))
	          .text(Y_DATA_FORMAT(d.frequency))
	          .style("visibility", "visible");
	      
	        d3.select(this)
	          .style("opacity", 0.7);
	      }).on("mouseout", function() {
	        detailBox.style("visibility", "hidden");
	        
	        d3.select(this)
	          .style("opacity", 1.0);
	      });
	}

	var outcomeCircle = function(tree, links) {
		var w = 800,
		    h = 800,
		    rx = w / 2,
		    ry = h / 2;

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
		d3.select("#outcomes div").remove();

		var div = d3.select("#outcomes").append("div")
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
		    .attr("d", d3.svg.arc().outerRadius(ry - 120).innerRadius(0).startAngle(0).endAngle(2 * Math.PI));


    	var nodes = cluster.nodes(tree);

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
	      .attr("markerWidth", 4)
	      .attr("markerHeight", 4)
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

	}

	var relationshipGraph = function(teams, links) {
		var width = 800,
		    height = 800;

		var color = d3.scale.category20();

		var force = d3.layout.force()
		    .charge(-360)
		    .linkDistance(75)
		    .size([width, height]);

		d3.select("#relationships div").remove();

		var div = d3.select("#relationships").append("div")
		    .style("width", "100%")
		    .style("height", "100%")
		    .style("-webkit-backface-visibility", "hidden");

		var svg = div.append("svg")
		    .attr("width", "100%")
		    .attr("height", "100%")
		    .attr("viewBox", "0 0 " + (width) + " " + (height))
		    .attr("preserveAspectRatio", "xMidYMid");

	    svg.append("defs").append("marker")
	      .attr("id", "arrowsm")
	      .attr("viewBox", "0 -5 10 10")
	      .attr("markerWidth", 2)
	      .attr("markerHeight", 2)
	      .attr("refX", 2.1)
	      .attr("orient", "auto")
	    .append("path")
	      .attr("d", "M10,-5L0,0L10,5");

		force
		  .nodes(teams)
		  .links(links)
		  .start();

		var link = svg.selectAll(".link")
		  .data(links)
		.enter().append("line")
		  .attr("class", "link")
		  .style("stroke-width", "2")
	      .attr("marker-start", "url(#arrowsm)");

		var nodeGroup = svg.selectAll(".node")
		  .data(teams).enter().append("g")
		  	  .attr("class", "node-group")
		  	  .call(force.drag);

		var node = nodeGroup.append("circle")
		  .attr("class", "node")
		  .attr("r", function(d) { return !(d.killed && d.killed.length) ? 2 : 0 } )

		nodeGroup.append("text")
		  .attr("dy", 0)
		  .attr("dx", 10)
		  .attr("font-size", "10px")
		  .text(function(d) { return d.name; });

		node.append("title")
		  .text(function(d) { return d.name; });

		force.on("tick", function() {
			link.attr("x1", function(d) { return d.source.x; })
			    .attr("y1", function(d) { return d.source.y; })
			    .attr("x2", function(d) { return d.target.x; })
			    .attr("y2", function(d) { return d.target.y; });

			nodeGroup.attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; });
		});

	}


	return {
		drawMemberHealth: memberHealth,
		drawTeamMembersRemaining: teamMembersRemaining,
		drawOutcomeCircle: outcomeCircle,
		drawRelationshipGraph: relationshipGraph
	}

}])

app.filter('partition', function() {
	var cache = {};
	var filter = function(arr, size) {
		if (!arr) { return; }
		var newArr = [];
		for (var i=0; i<arr.length; i+=size) {
			newArr.push(arr.slice(i, i+size));
		}
		var arrString = stringify(arr);
		var fromCache = cache[arrString+size];
		if (stringify(fromCache) === stringify(newArr)) {
			return fromCache;
		}
		cache[arrString+size] = newArr;
		return newArr;
	};
	return filter;
});

var appControllers = angular.module('assassinAppControllers', []);

appControllers.controller('MainCtrl', ['$scope', 'Resources', '$q', 'Graphs', '$anchorScroll',
	function($scope, Resources, $q, Graphs, $anchorScroll) {

		$anchorScroll();

		$scope._teams = Resources.Team.query();
		$scope._deaths = Resources.Death.query();
		$scope.rounds = Resources.Round.query();

		$scope.teams = [];
		$scope.deaths = [];

		$scope.members = [];

		$scope.$on('timer-tick', function(event, args) {
			$scope.currentDate = _.now();
		});

		$scope.getPromise = $q.all([$scope._teams.$promise, $scope._deaths.$promise, $scope.rounds.$promise]).then(function() {

			$scope.currentRound = _.last($scope.rounds);
			$scope.teamLookup = _($scope._teams).idLookup().value()
			$scope.deathLookup = _($scope._deaths).idLookup().value()

		});

		$scope.$watch("currentRound", function(newVal, oldVal) {
			if(newVal) $scope.refreshData();
		});

		$scope.getTooltip = function(member) {
			var killers = _(member.killers).pluck('name').join(', ');
			var kills = _(member.kills).pluck('name').join(', ');
			var result = [];
			if(kills) {
				result.push("Kills: " + kills)
			}
			if(killers) {
				result.push("Killed by: " + killers);
			}

			if(result.length > 0) {
				return result.join("<br />")
			} else {
				return null;
			}
		}

		$scope.refreshData = function() {

			$scope.teams = _($scope.currentRound.teams).pluck('id').map(function(teamId) {
				return _($scope.teamLookup[teamId]).clone();
			}).value();

			$scope.deaths = _($scope.currentRound.deaths).pluck('id').map(function(deathId) {
				return _($scope.deathLookup[deathId]).clone();
			}).value();

			var topElement = {
				parent: null,
				children: []
			};

			var memberElements = [];
			
			_($scope.teams).forEach(function(team, teamIndex) {

				var teamElement = {
					name: team.name,
					children: null,
					parent: topElement,
					kills: [],
					killed: []
				};


				var teamMembers = _(team.members).map(function(member, memberIndex) {
					return {
						id: member.id,
						name: member.name,
						team: team,
						killers: [],
						kills: [],
						children: [],
						parent: teamElement
					}
				}).forEach(function(member, memberIndex) {
					team.members[memberIndex] = member;
					memberElements.push(member);
				}).value();

				teamElement.children = teamMembers;
				topElement.children.push(teamElement);

			});

			var memberLookup = _(memberElements).idLookup().value();

			var links = [];
			_($scope.deaths).each(function(death, deathIndex) {
				_(death.killers).each(function(killer, killerIndex) {
					_(death.targets).each(function(target, targetIndex) {

						var killerNode = memberLookup[killer.id]
						var targetNode = memberLookup[target.id]

						if(!killerNode || !targetNode) return;

						killerNode.kills.push(targetNode);
						targetNode.killers.push(killerNode);

						targetNode.team.killed = _(targetNode.team.killed).union([targetNode]).value();
						killerNode.team.kills = _(killerNode.team.kills).union([targetNode]).value();

						links.push({
							source: targetNode,
							target: killerNode
						})

					})
				});
			});

			$scope.recentDeaths = _.chain($scope.deaths).sortBy('id').last(6).reverse().map(function(death) {

				var date = new Date(death.date);
				var dateString = (date.getMonth()+1) + "/" + date.getDate() + "/" + date.getFullYear();

				return _(death.killers).pluck('name').join(', ') + ' killed ' + _(death.targets).pluck('name').join(', ') + ' on ' + dateString;

			}).value();

			$scope.getTeamScore = function(team) {
				return ((team.kills && team.kills.length) || 0) - ((team.killed && team.killed.length) || 0);
			};

			var numDead = _(memberElements).filter(function(member) { return member.killers.length; }).value().length;
			var numAlive = memberElements.length - numDead;

			var membersRemaining = _($scope.teams).countBy(function(team) { return team.members.length - ((team.killed && team.killed.length) || 0); }).value();

			Graphs.drawMemberHealth(numAlive, numDead);
			Graphs.drawTeamMembersRemaining(membersRemaining);
			Graphs.drawOutcomeCircle(topElement, links);

			var teamCopy = _($scope.teams).map(function(team, teamIndex) { return _(team).clone(); }).clone();
			var teamCopyLookup = _(teamCopy).idLookup().value();
			var teamRelationships = [];

			_(teamCopy).forEach(function(team, teamIndex) {
				_(team.kills).pluck('team').uniq().forEach(function(target, targetIndex) {
					teamRelationships.push({
						source: teamCopyLookup[target.id],
						target: team
					});
				})
			});

			Graphs.drawRelationshipGraph(teamCopy, teamRelationships);

			//height fix for ie
			$(".svg-art svg").attr("height", function(i,e) {
				return Math.min($(this).width(), 800);
			});

		}

	}

]);
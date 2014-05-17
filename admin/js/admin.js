

var adminApp = angular.module('adminApp', [
	'ngRoute',
	'adminControllers',
	'ui',
	'ngResource',
	'mgcrea.ngStrap.navbar',
	'mgcrea.ngStrap.datepicker',
	'mgcrea.ngStrap.timepicker',
	'ui.bootstrap.tpls',
	'ui.bootstrap.pagination',
	'nya.bootstrap.select',
	'ui.multiselect'
]);

adminApp.directive('focusMe', function($timeout, $parse) {
  return {
    //scope: true,   // optionally create a child scope
    link: function(scope, element, attrs) {
      var model = $parse(attrs.focusMe);
      scope.$watch(model, function(value) {
        if(value === true) { 
          $timeout(function() {
            element[0].focus(); 
          });
        }
      });
      element.bind('blur', function() {
         scope.$apply(model.assign(scope, false));
      });
    }
  };
});

adminApp.directive('ngReallyClick', [function() {
    return {
        restrict: 'A',
        link: function(scope, element, attrs) {
            element.bind('click', function() {
                var message = attrs.ngReallyMessage;
                if (message && confirm(message)) {
                    scope.$apply(attrs.ngReallyClick);
                }
            });
        }
    }
}]);

adminApp.factory('Resources', ['$resource', function($resource) {
	var Member = $resource('/api/member/:id', {id:'@id'}, {
		query: {
			isArray: true,
			transformResponse: function(data, headersGetter) {
				return JSON.parse(data).objects;
			}
		},
		update: {method: 'PUT', headers: {'Content-Type': 'application/json'}}
	});
	var Team = $resource('/api/team/:id', {id:'@id'}, {
		query: {
			isArray: true,
			transformResponse: function(data, headersGetter) {
				var objs = JSON.parse(data).objects;
				objs.forEach(function(e, i) {
					e.members.forEach(function(mE, mI) {
						e.members[mI] = new Member(mE);
					});
					delete e.relationship_source;
					delete e.relationship_target;
					delete e.round_teams;
				});
				return objs;
			}
		},
		update: {method: 'PUT', headers: {'Content-Type': 'application/json'}}
	});
	var Relationship = $resource('/api/relationship/:id', {id:'@id'}, {
		query: {
			isArray: true,
			transformResponse: function(data, headersGetter) {
				var objs = JSON.parse(data).objects;
				objs.forEach(function(e, i) {
					e.targets.forEach(function(mE, mI) {
						e.targets[mI] = new Team(mE);
					});
					e.source = new Team(e.source);
				});
				return objs;
			}
		},
		update: {
			method: 'PUT',
			headers: {'Content-Type': 'application/json'}
		}
	});
	var Round = $resource('/api/round/:id', {id:'@id'}, {
		query: {
			isArray: true,
			transformResponse: function(data, headersGetter) {
				var objs = JSON.parse(data).objects;
				objs.forEach(function(e, i) {
					e.teams.forEach(function(mE, mI) {
						e.teams[mI] = new Team(mE);
					});
				});
				return objs;
			}
		},
		update: {method: 'PUT', headers: {'Content-Type': 'application/json'}}
	});
	var Death = $resource('/api/death/:id', {id:'@id'}, {
		query: {
			isArray: true,
			transformResponse: function(data, headersGetter) {
				var objs = JSON.parse(data).objects;
				objs.forEach(function(e, i) {
					delete e.round_deaths;
				});
				return objs;
			}
		},
		update: {method: 'PUT', headers: {'Content-Type': 'application/json'}}
	});
	Death.prototype.toString = function() {
			var date = new Date(this.date);
			var dateString = (date.getMonth()+1) + "/" + date.getDate() + "/" + date.getFullYear();

			return _(this.killers).pluck('name').join(', ') + ' killed ' + _(this.targets).pluck('name').join(', ') + ' on ' + dateString;
	}
	return {
		Member: Member,
		Team: Team,
		Relationship: Relationship,
		Round: Round,
		Death: Death
	}
}]);

adminApp.config(['$routeProvider', '$sceProvider',
	function($routeProvider, $sceProvider) {
		$routeProvider.
			when('/teams', {
				templateUrl: 'partials/teams.html',
				controller: 'TeamsCtrl'
			}).
			when('/relationships', {
				templateUrl: 'partials/relationships.html',
				controller: 'RelationshipsCtrl'
			}).
			when('/deaths', {
				templateUrl: 'partials/deaths.html',
				controller: 'DeathsCtrl'
			}).
			when('/rounds', {
				templateUrl: 'partials/rounds.html',
				controller: 'RoundsCtrl'
			}).
			when('/random', {
				templateUrl: 'partials/random.html',
				controller: 'RandomCtrl'
			}).
			when('/control', {
				templateUrl: 'partials/control.html',
				controller: 'ControlCtrl'
			}).
			otherwise({
				redirectTo: '/teams'
			});
		$sceProvider.enabled(true);
	}
]);


var adminControllers = angular.module('adminControllers', []);

adminControllers.controller('TeamsCtrl', ['$scope', '$http', 'Resources', '$timeout',
	function($scope, $http, Resources, $timeout) {
		$scope.teams = Resources.Team.query();

		$scope.newTeam = function() {
			var team = new Resources.Team({editing:true,members:[]});
			team.$save();
			$scope.teams.push(team)
		}
		$scope.deleteTeam = function(team, teamIndex) {
			$scope.teams.splice(teamIndex, 1);
			team.$delete();
		}
		$scope.updateTeam = function(team) {
			team.$update();
		}

		$scope.newMember = function(team) {
			var member = new Resources.Member({editing:true});
			member.$save();
			team.members.push(member);
			team.$update();
		}
		$scope.deleteMember = function(team, memberIndex) {
			team.members[memberIndex].$delete();
			team.members.splice(memberIndex, 1);
			team.$update();
		}
		$scope.updateMember = function(member) {
			$timeout(function() {
				new Resources.Member(member).$update();
			}, 50)
		}

	}])
adminControllers.controller('RelationshipsCtrl', ['$scope', '$http', 'Resources', '$timeout',
	function($scope, $http, Resources, $timeout) {

		$scope.relationships = Resources.Relationship.query();
		$scope.teams = Resources.Team.query();

		$scope.newRelationship = function() {
			var relationship = new Resources.Relationship({both:false});
			relationship.$save();
			$scope.relationships.push(relationship);
		}
		$scope.updateRelationship = function(relationship) {
			relationship.$update();
		}
		$scope.deleteRelationship = function(relationship, relationshipIndex) {
			relationship.$delete();
			$scope.relationships.splice(relationshipIndex, 1);
		}
	}])
adminControllers.controller('DeathsCtrl', ['$scope', '$http', 'Resources', '$timeout',
	function($scope, $http, Resources, $timeout) {
		$scope.teams = Resources.Team.query();
		$scope.deaths = Resources.Death.query();
		$scope.flattened = [];
		$scope.team_id_to_name = {};
		$scope.numItems = 0;
		$scope.itemsPerPage = 5;
		$scope.currentPage = 1;

		$scope.teams.$promise.then(function() {
			$scope.teams.forEach(function(e, i) {
				$scope.team_id_to_name[e.id] = e.name;
				e.members.forEach(function(mE, mI) {
					$scope.flattened.push(mE);
				});
			});
		});

		$scope.deaths.$promise.then(function() {
			$scope.numItems = $scope.deaths.length;
			$scope.currentPage = Math.ceil(($scope.deaths.length / $scope.itemsPerPage));
		});

		$scope.flatten = function() {
			var results = [];
			$scope.teams.forEach(function(e, i) {
				e.members.forEach(function(mE, mI) {
					results.push(mE);
				})
			});
			results.sort(function(a, b) {
				if (a.name > b.name) {
					return 1;
				}
				if (a.name < b.name) {
					return -1;
				}
				// a must be equal to b
				return 0;
			});
			return results;
		}

		$scope.newDeath = function() {
			var death = new Resources.Death({killers: [], targets: [], date: null});
			$scope.deaths.push(death);
			death.$save(function() {
				$scope.currentPage = Math.ceil(($scope.deaths.length / $scope.itemsPerPage));
				$scope.numItems = $scope.deaths.length;
			});
		}

		$scope.updateDeath = function(death) {
			death.$update();
		}

		$scope.deleteDeath = function(death, deathIndex, currentPage) {
			$scope.deaths.splice((currentPage-1)*$scope.itemsPerPage + deathIndex, 1);
			death.$delete(function() {
				$scope.currentPage = Math.ceil(($scope.deaths.length / $scope.itemsPerPage));
				$scope.numItems = $scope.deaths.length;
			});
		}


	}])

adminControllers.controller('RandomCtrl', ['$scope', '$http', 'Resources', '$timeout',
	function($scope, $http, Resources, $timeout) {
		$scope.teams = Resources.Team.query(function() {
			$scope.randomize();
		});
		$scope.pairs = [];

		$scope.randomize = function() {
			$scope.pairs = [];

			var shuffled = _.shuffle($scope.teams);
			var first = shuffled[0];
			var last = _.last(shuffled);

			var startingElement = shuffled[0];
			for(var i=1;i<shuffled.length;i++) {
				$scope.pairs.push({
					killer: startingElement,
					target: shuffled[i]
				});
				startingElement = shuffled[i];
			}
			$scope.pairs.push({
				killer: last,
				target: first
			});
		}

	}])

adminControllers.controller('RoundsCtrl', ['$scope', '$http', 'Resources', '$timeout',
	function($scope, $http, Resources, $timeout) {

		$scope.rounds = Resources.Round.query();
		$scope.teams = Resources.Team.query();
		$scope.deaths = Resources.Death.query();

		$scope.newRound = function() {
			var round = new Resources.Round();
			round.$save();
			$scope.rounds.push(round);
		}

		$scope.updateRound = function(round) {
			console.log(round);
			round.$update();
		}
		$scope.deleteRound = function(round, roundIndex) {
			round.$delete();
			$scope.rounds.splice(roundIndex, 1);
		}
		$scope.fancyDeath = function(death) {
			var date = new Date(death.date);
			var dateString = (date.getMonth()+1) + "/" + date.getDate() + "/" + date.getFullYear();

			return _(death.killers).pluck('name').join(', ') + ' killed ' + _(death.targets).pluck('name').join(', ') + ' on ' + dateString;
		}
	}])

adminControllers.controller('ControlCtrl', ['$scope', '$http', 'Resources', '$timeout',
	function($scope, $http, Resources, $timeout) {
		$scope.teams = Resources.Team.query();
		$scope.flattened = [];
		$scope.team_id_to_name = {};
		$scope.numItems = 0;
		$scope.currentPage = 1;

		$scope.teams.$promise.then(function() {
			$scope.numItems = $scope.teams.length;
			$scope.teams.forEach(function(e, i) {
				$scope.team_id_to_name[e.id] = e.name;
				e.members.forEach(function(mE, mI) {
					$scope.flattened.push(mE);
				});
			});
		});
	}])
define('event', ['./invite', './ouibounce', './params', './touch-scroll', './util', 'jquery', 'json-rules-engine'], function (Invite, ouibounce, Params, TouchScroll, Util, $, RulesEngine) {

  var cookies = {
    'bounce': 'party_exit',
    'timeOnSite': 'party_tos',
    'pageViews': 'party_views'
  };

  var Event = {

    config: {},
    Engine: {},
    factsObject: {},
    monitor: null,
    triggersLoaded: {},

    bindEvents: function (config) {
      Event.config = config;
      if (typeof(Event.config.callback) !== 'function') {
        Event.config.callback = function () {};
      }

      var now = new Date();

      if (Params.confettiType === 'multi') {

        // Combination Trigger
        if (Params.combinationTrigger) {
          Event.Engine = new RulesEngine.Engine();
          Event.factsObject = {
            'bounce': false,
            'pageScrollPercentage': false,
            'pageViews': false,
            'timeOnSite': false,
            'timeOnPage': false,
            'touchScroll': false
          };

          var ruleValue = JSON.parse(Params.combinationTrigger);
          if (Params.bounceAfterTrigger) {
            ruleValue.onSuccess = function () {
              clearInterval(Event.monitor);
              Params.combinationTrigger = '';
              Event.triggersLoaded.bounceAfterTrigger.triggered = true;
              Event.Engine.stop();
              Event.setBounce();
              Console.log('Combination trigger satisfied, bounce listener is set');
              Console.log('almanac', almanac);
              Console.log('ruleResult', ruleResult);              
            }
          } else {
            ruleValue.onSuccess = function (engineEvent, almanac, ruleResult) {
              Console.log('almanac', almanac);
              Console.log('ruleResult', ruleResult);
              var trigger = Util.iterateRuleObject(ruleResult.conditions);
              Event.renderConfetti(trigger);
              Event.Engine.stop();
            }
          }
          var Rule = new RulesEngine.Rule(ruleValue);
          Event.Engine.addRule(Rule);
        }

        // Bounce AND other trigger
        if (Params.bounceAfterTrigger) { // if bounceAfter
          if (!Params[Params.bounceAfterTrigger]) { // but no value in the other trigger
            Params.bounceAfterTrigger = null
          } else {
            Event.triggersLoaded.bounceAfterTrigger = {name: Params.bounceAfterTrigger, triggered: false};
            Params.bounce = null;
            if (!Params.combinationTrigger) {
              var otherPossibleTriggers = ["pageScrollPercentage", "pageViews", "timeOnPage", "timeOnSite"];
              for (var trigger = 0; trigger < otherPossibleTriggers.length; trigger++) {
                if (Params.bounceAfterTrigger === otherPossibleTriggers[trigger]) {
                  continue;
                } else {
                  var getsNull = otherPossibleTriggers[trigger];
                  Params[getsNull] = null;
                }
              }
            }
          }
        }

        // Touch scroll setup
        if (Params.touchScrollEnabled && Params.deviceType !== "DESKTOP") {
          document.addEventListener('touchstart', TouchScroll.touchStartHandler, {capture: true, once: false, passive: true});
          document.addEventListener('touchend', TouchScroll.touchEndHandler, {capture: true, once: false, passive: true});
          Event.triggersLoaded.touchScrollEnabled = {name: 'touchScroll', triggered: false};
        }

        var triggerReset = this.getTriggerReset();

        // Time on site
        if (Util.isNumber(Util.getCookie(cookies.timeOnSite))) {
          Event.triggersLoaded.timeOnSite = {name: 'time on site'};
        } else {
          var value = null;
          if (Util.isNumber(Params.timeOnSite) && Params.timeOnSite > 0) {
            value = now.valueOf() + Params.timeOnSite;

            Util.setCookie(cookies.timeOnSite, value, triggerReset, Params.domain);
            Event.triggersLoaded.timeOnSite = {name: 'time on site'};
          }
        }

        // Page views
        if (Util.isNumber(Params.pageViews) && Params.pageViews > 0) {
          var pageViews = Util.getCookie(cookies.pageViews);

          if (Util.isNumber(pageViews)) {
            pageViews++;
          } else {
            pageViews = 1;
          }

          Util.setCookie(cookies.pageViews, pageViews, triggerReset, Params.domain);
          Event.triggersLoaded.pageViews = {name: 'page views', total: pageViews};
        }
      }

      // Time on page
      if (Util.isNumber(Params.timeOnPage) && Params.timeOnPage > 0) {
        timeOnPage = now.valueOf() + Params.timeOnPage;
        Event.triggersLoaded.timeOnPage = {name: 'time on page', timeOnPage: timeOnPage};
      }

      // Page scroll percentage
      if (Util.isNumber(Params.pageScrollPercentage) && Params.pageScrollPercentage > 0) {
        Event.triggersLoaded.pageScrollPercentage = {name: 'page scroll percentage'};
      }

      // Bounce without 'after'
      if ((Params.bounce && !Params.bounceAfterTrigger) || (Params.bounce && Params.bounceAfterTrigger && !Params[Params.bounceAfterTrigger])) {
        Event.triggersLoaded.bounce = {name: 'bounce'};
      }
    },

    getTriggerReset: function () {
      if (Util.isNumber(Params.triggerReset) && Params.triggerReset > 0) {
        return Params.triggerReset;
      } else if (Util.isNumber(Params.frequency) && Params.frequency > 0) {
        return Params.frequency;
      }
      return null;
    },

    monitorEvents: function () {

      if (Util.getObjectLength(Event.triggersLoaded)) {
        var monitorCallback = function () {
          var now = new Date();

          for (var key in Event.triggersLoaded) {
            if (Event.triggersLoaded.hasOwnProperty(key)) {
              var event = Event.triggersLoaded[key];

              // Time on site
              if (event.name === 'time on site') {
                var timeOnSite = Util.getCookie(cookies.timeOnSite);

                if (Util.isNumber(timeOnSite) && timeOnSite < now.valueOf()) {
                  if (Params.bounceAfterTrigger && Event.triggersLoaded.bounceAfterTrigger.name === 'timeOnSite') {
                    Event.triggersLoaded.bounceAfterTrigger.triggered = true;
                  } else {
                    Event.handleEvent('timeOnSite');
                  }
                }
              }

              // Time on page
              if (event.name === 'time on page') {
                if (Util.isNumber(event.timeOnPage) && event.timeOnPage < now.valueOf()) {
                  delete Event.triggersLoaded.timeOnPage;
                if (Params.bounceAfterTrigger && Event.triggersLoaded.bounceAfterTrigger.name === 'timeOnPage') {
                    Event.triggersLoaded.bounceAfterTrigger.triggered = true;
                } else {
                    Event.handleEvent('timeOnPage');
                }
                }
              }

            }
          }
        };

        if (Event.triggersLoaded.timeOnSite || Event.triggersLoaded.timeOnPage) {
          Event.monitor = setInterval(monitorCallback, 500);
        }

        // Page scroll percentage
        if (Event.triggersLoaded.pageScrollPercentage) {
          var scrollHandler = function (e) {
            var height = $(document).height(),
              scroll = $(window).scrollTop(),
              percentage = parseInt(scroll / height * 100);
              Console.log('pageScrollPercentage:', percentage);

            if (Params.pageScrollPercentage <= percentage) {
              Console.log('pageScrollPercentage: condition met');
              $(window).off('scroll', scrollHandler);
              if (Params.bounceAfterTrigger && Event.triggersLoaded.bounceAfterTrigger.name === 'pageScrollPercentage') {
                Event.triggersLoaded.bounceAfterTrigger.triggered = true;
              } else {
                Event.handleEvent('pageScrollPercentage');
              }
            }
          };
          $(window).scroll(scrollHandler);
        }

        // Touch Scroll window listeners are also running if enabled in Event.bindEvents

        // Page views
        if (Event.triggersLoaded.pageViews) {
          if (Event.triggersLoaded.pageViews.total >= Params.pageViews) {
            if (Params.bounceAfterTrigger && Event.triggersLoaded.bounceAfterTrigger.name === 'pageViews') {
              Event.triggersLoaded.bounceAfterTrigger.triggered = true;
            } else {
              Event.handleEvent('pageViews');
            }
          }
        }

        //Bounce || BounceAfter
        if (Event.triggersLoaded.bounce || (Event.triggersLoaded.bounceAfterTrigger && !Params.combinationTrigger)) {
          Event.setBounce();
        }

      } else { // nothing to do here now? maybe a default "renderConfetti?"
      }
    },

    setBounce: function () {
      var trigger = Event.triggersLoaded.bounceAfterTrigger ? 'bounceAfterTrigger' : 'bounce';
      var ouibounceConfig = {
        aggressive: true,
        callback: function () {
          Event.handleEvent(trigger);
        },
        cookieName: cookies.bounce,
        delay: Params.bounceDelay,
        sensitivity: 20,
        sitewide: true,
        timer: 1000
      };

      ouibounce(false, ouibounceConfig);
    },

    handleEvent: function (trigger) {
      if (Params.combinationTrigger) {
        Event.factsObject[trigger] = true;
        var facts = Object.assign({}, Event.factsObject);
        Event.Engine.run(facts);
      } else {
        var cookieToKill = cookies[trigger] || '';

        if (testForBounceAfter()) {
          Event.renderConfetti(trigger, cookieToKill);
        }

        function testForBounceAfter() {

          var bounceAfterTriggerConditions =
            Event.triggersLoaded.bounceAfterTrigger &&
            Event.triggersLoaded.bounceAfterTrigger.triggered &&
            trigger === 'bounceAfterTrigger';

          var unrelatedTrigger =
            !Event.triggersLoaded.bounceAfterTrigger ||
            (Event.triggersLoaded.bounceAfterTrigger && 
              (trigger !== Event.triggersLoaded.bounceAfterTrigger.name) &&
              (trigger !== 'bounceAfterTrigger'));

          if (bounceAfterTriggerConditions || unrelatedTrigger) {
            trigger = bounceAfterTriggerConditions ? 'bounceAnd' + Params.bounceAfterTrigger : trigger;
            return true
          }

          Event.setBounce();
          return false;
        }
      }
    },

    renderConfetti: function (trigger, cookieToKill) {
    if (Params.confetti) Util.removeCookie(cookieToKill, Params.domain);
    clearInterval(Event.monitor);
    Event.triggersLoaded = {};
    Event.config.callback();
    }
  };

  return Event;

});

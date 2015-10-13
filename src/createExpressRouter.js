/**
 * @flow
 */
const React = require('react');
const express = require('express');
//const { match, RoutingContext } = require('react-router');
//ERROR, flow error
const ReactRouter = require('react-router');
const match = ReactRouter.match;
const RoutingContext = ReactRouter.RoutingContext;
//*/

const RouteParser = require('./RouteParser');

type ServerSettings = {
	routes: ReactRouterRoute,
	props: ?({[key: string]: any} | (req: ExpressReq) => {[key: string]: any}),
	responseHandler: (reactStr: string, req: ExpressReq, res: ExpressRes) => void,
	errorHandler: ?(err: Error, req: ExpressReq, res: ExpressRes) => void,
};

/**
 * Create an express router for the given react-router routes.
 *
 * @param settings			{object}
 *			routes				{ReactRouterRoute}		The router to render
 *			[props]				{Object}				Props to add to the top-level handler
 *			responseHandler		{						A functions that should send the response
 *														to an initial page load request
 *	 								(	string,				The rended html for the current route
 *										ExpressReq,			The express request
 *										ExpressRes			The erpress resonse
 *									) => void
 *								}
 *			[errorHandler]		{						A functions that should send the response
 *														for any error on the server
 *									(	Error,				The error to handle
 *										ExpressReq,			The express request
 *										ExpressRes			The erpress resonse
 *									) => void
 *								}
 *
 * @return					{ExpressRouter}				The express router to add to the express
 *														application
 */
function createExpressRouter(settings: ServerSettings): ExpressRouter {
	// Get route
	if(!settings.routes) throw new Error('Route is required for the server');
	const routerParser = new RouteParser(settings.routes);
	const routes = routerParser.getReactRouterRoute();
	const expressRouterFromRoute = routerParser.getExpressRouter();

	// Get request handlers
	if(!settings.responseHandler) throw new Error('The responseHandler is required for the server');
	const responseHandler = settings.responseHandler;
	const errorHandler = settings.errorHandler? settings.errorHandler: defaultErrorHandler;

	if(typeof responseHandler !== 'function' || typeof errorHandler !== 'function') {
		throw new Error('The responseHandler / errorHandler must be a function');
	}

	// Create express router
	let router = express.Router();
	router.use((req, res, next) => {
		// Get current react-router route
		const location = req.url;
		match({ routes, location }, (err, redirectLocation, renderProps) => {
			if(err) {
				// Handle errors in route
				next(err);
			}
			else if(redirectLocation) {
				// Handle redirect
				res.redirect(302, redirectLocation.pathname + redirectLocation.search)
			}
			else if(renderProps) {
				// Render react-router handler
				const props = Object.assign({},
					renderProps,
					settings.props?
						typeof settings.props === 'function'? settings.props(req): settings.props:
						{}
				);
				const renderedReactHtml = React.renderToString(<RoutingContext {...props} />);

				// Send to client
				responseHandler(renderedReactHtml, req, res);
			}
			else {
				// Send basic 404 message (if not included in the route)
				res.status(404).send({
					errorName: '404',
					errorMessage: `Location: ${location}`
				});
			}
		});
	});
	router.use(expressRouterFromRoute);
	router.use((err, req, res, next) => { errorHandler(err, req, res); });

	return express.Router();
}

/*------------------------------------------------------------------------------------------------*/
//	--- Helper functions ---
/*------------------------------------------------------------------------------------------------*/
function defaultErrorHandler(err: Error, req: ExpressReq, res: ExpressRes) {
	 res.status(500).send({ errorName: err.name, errorMessage: err.message });
}

/*------------------------------------------------------------------------------------------------*/
//	--- Exports ---
/*------------------------------------------------------------------------------------------------*/
module.exports = createExpressRouter;
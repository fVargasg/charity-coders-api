// Express docs: http://expressjs.com/en/api.html
const express = require('express')
// Passport docs: http://www.passportjs.org/docs/
const passport = require('passport')

// pull in Mongoose model for organizations
const Organization = require('../models/organization')

// we'll use this to intercept any errors that get thrown and send them
// back to the client with the appropriate status code
const handle = require('../../lib/error_handler')

// this is a collection of methods that help us detect situations when we need
// to throw a custom error
const customErrors = require('../../lib/custom_errors')

// we'll use this function to send 404 when non-existant document is requested
const handle404 = customErrors.handle404
// we'll use this function to send 401 when a user tries to modify a resource
// that's owned by someone else
const requireOwnership = customErrors.requireOwnership

// passing this as a second argument to `router.<verb>` will make it
// so that a token MUST be passed for that route to be available
// it will also set `res.user`
const requireToken = passport.authenticate('bearer', { session: false })

// instantiate a router (mini app that only handles routes)
const router = express.Router()

// INDEX
// GET /organizations
router.get('/organizations', requireToken, (req, res) => {
    Organization.find({ owner: req.user.id })
    .then(organizations => {
      // `organizations` will be an array of Mongoose documents
      // we want to convert each one to a POJO, so we use `.map` to
      // apply `.toObject` to each one
      return organizations.map(organization => organization.toObject())
    })
    // respond with status 200 and JSON of the organizations
    .then(organizations => res.status(200).json({ organizations: organizations }))
    // if an error occurs, pass it to the handler
    .catch(err => handle(err, res))
})

// SHOW
// GET /organizations/5a7db6c74d55bc51bdf39793
router.get('/organizations/:id', requireToken, (req, res) => {
  // req.params.id will be set based on the `:id` in the route
  Organization.findById(req.params.id)
    .then(handle404)
    // if `findById` is succesful, respond with 200 and "organization" JSON
    .then(organization => res.status(200).json({ organization: organization.toObject() }))
    // if an error occurs, pass it to the handler
    .catch(err => handle(err, res))
})

// CREATE
// POST /organizations
router.post('/organizations', requireToken, (req, res) => {
  // set owner of new organization to be current user
  req.body.organization.owner = req.user.id

  Organization.create(req.body.organization)
    // respond to succesful `create` with status 201 and JSON of new "organization"
    .then(organization => {
      res.status(201).json({ organization: organization.toObject() })
    })
    // if an error occurs, pass it off to our error handler
    // the error handler needs the error message and the `res` object so that it
    // can send an error message back to the client
    .catch(err => handle(err, res))
})

// UPDATE
// PATCH /organizations/5a7db6c74d55bc51bdf39793
router.patch('/organizations/:id', requireToken, (req, res) => {
  // if the client attempts to change the `owner` property by including a new
  // owner, prevent that by deleting that key/value pair
  delete req.body.organization.owner

  Organization.findById(req.params.id)
    .then(handle404)
    .then(organization => {
      // pass the `req` object and the Mongoose record to `requireOwnership`
      // it will throw an error if the current user isn't the owner
      requireOwnership(req, organization)

      // the client will often send empty strings for parameters that it does
      // not want to update. We delete any key/value pair where the value is
      // an empty string before updating
      Object.keys(req.body.organization).forEach(key => {
        if (req.body.organization[key] === '') {
          delete req.body.organization[key]
        }
      })

      // pass the result of Mongoose's `.update` to the next `.then`
      return organization.update(req.body.organization)
    })
    // if that succeeded, return 204 and no JSON
    .then(() => res.sendStatus(204))
    // if an error occurs, pass it to the handler
    .catch(err => handle(err, res))
})

// DESTROY
// DELETE /organizations/5a7db6c74d55bc51bdf39793
router.delete('/organizations/:id', requireToken, (req, res) => {
  Organization.findById(req.params.id)
    .then(handle404)
    .then(organization => {
      // throw an error if current user doesn't own `organization`
      requireOwnership(req, organization)
      // delete the organization ONLY IF the above didn't throw
      organization.remove()
    })
    // send back 204 and no content if the deletion succeeded
    .then(() => res.sendStatus(204))
    // if an error occurs, pass it to the handler
    .catch(err => handle(err, res))
})

module.exports = router

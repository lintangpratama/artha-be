/* eslint-disable linebreak-style */
/* eslint-disable quotes */
require("dotenv").config();

const Hapi = require("@hapi/hapi");
const Jwt = require("@hapi/jwt");

const ClientError = require("./exceptions/ClientError");

// authentications
const authentications = require("./api/authentications");
const AuthenticationsService = require("./services/postgres/AuthenticationsService");
const TokenManager = require("./tokenize/TokenManager");
const AuthenticationsValidator = require("./validator/authentications");

// users
const users = require("./api/users");
const UsersService = require("./services/postgres/UsersService");
const UsersValidator = require("./validator/users");

// registrations
const registrations = require("./api/registrations");
const RegistrationsService = require("./services/postgres/RegistrationService");
const RegistrationsValidator = require("./validator/registration");

// untis
const units = require("./api/units");
const UnitsService = require("./services/postgres/UnitsService");

// categories
const categories = require("./api/categories");
const CategoriesService = require("./services/postgres/CategoriesService");
const CategoriesValidator = require("./validator/categories");

// customers
const customers = require("./api/customers");
const CustomersService = require("./services/postgres/CustomersService");
const CustomerValidator = require("./validator/customers");

// products
const products = require("./api/products");
const ProductsService = require("./services/postgres/ProductsService");
const ProductsValidator = require("./validator/products");

// sales
const sales = require("./api/sales");
const SalesService = require("./services/postgres/SalesService");
const SalesValidator = require("./validator/sales");

// purchases
const purchases = require("./api/purchases");
const PurchasesService = require("./services/postgres/PurchasesService");
const PurchasesValidator = require("./validator/purchases");

// dashboard
const general = require("./api/general");
const GeneralService = require("./services/postgres/GeneralService");

const init = async () => {
  // instances
  const usersService = new UsersService();
  const authenticationsService = new AuthenticationsService();
  const registrationsService = new RegistrationsService(usersService);
  const unitsService = new UnitsService();
  const categoriesService = new CategoriesService();
  const customersService = new CustomersService();
  const productsService = new ProductsService();
  const salesService = new SalesService();
  const purchasesService = new PurchasesService();
  const generalService = new GeneralService();

  // server
  const server = Hapi.server({
    port: process.env.PORT,
    host: process.env.HOST,
    debug: { log: ["error", "database", "read"] },
    routes: {
      cors: {
        origin: ["*"],
      },
    },
  });

  server.log(['test', 'error'], 'Test event');

  // register plugin
  await server.register([
    {
      plugin: Jwt,
    },
  ]);

  await server.register({
    plugin: require("hapi-pino"),
    options: {
      // Redact Authorization headers, see https://getpino.io/#/docs/redaction
      redact: ["req.headers.authorization"],
    },
  });

  // also as a decorated API
  server.logger.info("another way for accessing it");

  // and through Hapi standard logging system
  server.log(["subsystem"], "third way for accessing it");

  // jwt
  server.auth.strategy("kasiraja_jwt", "jwt", {
    keys: process.env.ACCESS_TOKEN_KEY,
    verify: {
      aud: false,
      iss: false,
      sub: false,
      maxAgeSec: process.env.ACCESS_TOKEN_AGE,
    },
    validate: (artifacts) => ({
      isValid: true,
      credentials: {
        id: artifacts.decoded.payload.id,
        companyId: artifacts.decoded.payload.companyId,
      },
    }),
  });

  // route
  server.route([
    {
      method: "GET",
      path: "/",
      handler: () => ({
        data: {
          status: "Ok!",
          name: "kasirAja Api",
          version: "1.0.0",
        },
      }),
    },
    {
      method: "*",
      path: "/{p*}", // catch-all path
      handler: (request, h) => {
        const response = h.response({
          status: "404",
          message: "Not Found",
        });
        response.code(404);
        return response;
      },
    },
  ]);

  // catch error response
  server.ext("onPreResponse", (request, h) => {
    const { response } = request;

    if (response instanceof ClientError) {
      const newResponse = h.response({
        status: "fail",
        message: response.message,
      });
      newResponse.code(response.statusCode);
      return newResponse;
    }
    if (response instanceof Error) {
      console.log(response);
    }

    return response.continue || response;
  });

  // register plugin -> routes
  await server.register([
    {
      plugin: authentications,
      options: {
        authenticationsService,
        usersService,
        tokenManager: TokenManager,
        validator: AuthenticationsValidator,
      },
    },
    {
      plugin: registrations,
      options: {
        service: registrationsService,
        validator: RegistrationsValidator,
      },
    },
    {
      plugin: users,
      options: {
        service: usersService,
        validator: UsersValidator,
      },
    },
    {
      plugin: units,
      options: {
        service: unitsService,
      },
    },
    {
      plugin: customers,
      options: {
        service: customersService,
        validator: CustomerValidator,
      },
    },
    {
      plugin: products,
      options: {
        service: productsService,
        validator: ProductsValidator,
      },
    },
    {
      plugin: categories,
      options: {
        service: categoriesService,
        validator: CategoriesValidator,
      },
    },
    {
      plugin: sales,
      options: {
        service: salesService,
        validator: SalesValidator,
      },
    },
    {
      plugin: purchases,
      options: {
        service: purchasesService,
        validator: PurchasesValidator,
      },
    },
    {
      plugin: general,
      options: {
        service: generalService,
      },
    },
  ]);

  await server.start();
  console.log(`Server running at ${server.info.uri}`);
};

init();

"""
KS Function Component.
"""
from six.moves import range

import numpy as np

from openmdao.core.explicitcomponent import ExplicitComponent


CITATIONS = """
@conference {Martins:2005:SOU,
        title = {On Structural Optimization Using Constraint Aggregation},
        booktitle = {Proceedings of the 6th World Congress on Structural and Multidisciplinary
                     Optimization},
        year = {2005},
        month = {May},
        address = {Rio de Janeiro, Brazil},
        author = {Joaquim R. R. A. Martins and Nicholas M. K. Poon}
}
"""


class KSfunction(object):
    """
    Helper class for KS.

    Helper class that can be used inside other components to aggregate constraint vectors with a
    Kreisselmeier-Steinhauser Function.
    """

    def compute(self, g, rho=50.0):
        """
        Compute the value of the KS function for the given array of constraints.

        Parameters
        ----------
        g : ndarray
            Array of constraint values, where negative means satisfied and positive means violated.
        rho : float
            Constraint Aggregation Factor.

        Returns
        -------
        float
            Value of KS function.
        """
        self.rho = rho
        g_max = np.max(g)
        self.g_diff = g - g_max
        self.exponents = np.exp(rho * self.g_diff)
        self.summation = np.sum(self.exponents)
        KS = g_max + 1.0 / rho * np.log(self.summation)

        return KS

    def derivatives(self):
        """
        Compute elements of [dKS_gd, dKS_drho] based on previously computed values.

        Returns
        -------
        ndarray
            Derivative of KS function with respect to parameter values.
        """
        dsum_dg = self.rho * self.exponents
        dKS_dsum = 1.0 / (self.rho * self.summation)
        dKS_dg = dKS_dsum * dsum_dg

        dsum_drho = np.sum(self.g_diff * self.exponents)
        dKS_drho = dKS_dsum * dsum_drho

        return dKS_dg, dKS_drho


class KSComponent(ExplicitComponent):
    """
    KS function component.

    Component that aggregates a number of functions to a single value via the
    Kreisselmeier-Steinhauser Function. This new constraint is satisfied when it
    is less than or equal to zero.

    Options
    -------
    lower_flag : bool(False)
        Set to True to turn upper bound into a lower bound for satisfaction.
    rho : float(50.0)
        Constraint Aggregation Factor.
    upper : float(0.0)
        Upper bound for constraint, default is zero.
    """

    def __init__(self, width=1, vec_size=1):
        """
        Initialize the KS component.

        Parameters
        ----------
        width : dict of keyword arguments
            'Width of constraint vector.
        vec_size : int
            The number of rows to independently aggregate.
        """
        super(KSComponent, self).__init__(width=width, vec_size=vec_size)

        self.options.declare('lower_flag', False,
                             desc="Set to True to reverse sign of input constraints.")
        self.options.declare('rho', 50.0, desc="Constraint Aggregation Factor.")
        self.options.declare('upper', 0.0, desc="Upper bound for constraint, default is zero.")

        self.cite = CITATIONS

    def initialize(self):
        """
        Declare metadata.
        """
        self.metadata.declare('width', types=int, default=1, desc='Width of constraint vector.')
        self.metadata.declare('vec_size', types=int, default=1,
                              desc='The number of rows to independently aggregate.')

    def setup(self):
        """
        Declare inputs, outputs, and derivatives for the KS component.
        """
        meta = self.metadata
        width = meta['width']
        vec_size = meta['vec_size']

        # Inputs
        self.add_input('g', shape=(vec_size, width),
                       desc="Array of function values to be aggregated")

        # Outputs
        self.add_output('KS', shape=(vec_size, 1), desc="Value of the aggregate KS function")

        rows = np.zeros(width, dtype=np.int)
        cols = range(width)
        rows = np.tile(rows, vec_size) + np.repeat(np.arange(vec_size), width)
        cols = np.tile(cols, vec_size) + np.repeat(np.arange(vec_size), width) * width

        self.declare_partials(of='KS', wrt='g', rows=rows, cols=cols)
        self._ks = KSfunction()

    def compute(self, inputs, outputs):
        """
        Compute the output of the KS function.

        Parameters
        ----------
        inputs : `Vector`
            `Vector` containing inputs.
        outputs : `Vector`
            `Vector` containing outputs.
        """
        opt = self.options
        con_val = inputs['g'] - opt['upper']
        if opt['lower_flag']:
            con_val = -con_val

        for j in range(self.metadata['vec_size']):
            outputs['KS'][j, :] = self._ks.compute(con_val[j, :], opt['rho'])

    def compute_partials(self, inputs, partials):
        """
        Compute sub-jacobian parts. The model is assumed to be in an unscaled state.

        Parameters
        ----------
        inputs : Vector
            unscaled, dimensional input variables read via inputs[key]
        partials : Jacobian
            sub-jac components written to partials[output_name, input_name]
        """
        meta = self.metadata
        width = meta['width']
        vec_size = meta['vec_size']

        derivs = np.empty((vec_size, width))

        for j in range(vec_size):
            derivs[j, :] = self._ks.derivatives()[0]

        if self.options['lower_flag']:
            derivs = -derivs

        partials['KS', 'g'] = derivs.flatten()

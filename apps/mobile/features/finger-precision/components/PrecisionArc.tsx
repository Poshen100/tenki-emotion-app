/**
 * @module finger-precision/components/PrecisionArc
 * @description Platform-aware wrapper for PrecisionArc component.
 *
 * @version 1.0
 */

import { Platform } from 'react-native';
import { PrecisionArc as NativeArc } from './PrecisionArc.native';
import { PrecisionArc as WebArc } from './PrecisionArc.web';

export const PrecisionArc = Platform.OS === 'web' ? WebArc : NativeArc;

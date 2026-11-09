<?php
/**
 * Template for {@see \ErdemBircan\BatterySurfBench\DevTools\Views\DevToolsPanelView}: the dev-tools panel: the DEV pill and the card with the Battery, Discharge and Surf groups.
 *
 * @package ErdemBircan\BatterySurfBench
 *
 * @var array<string, mixed> $args Keys read: `course_slugs_json` (attribute
 *       value), `dev` (text), `eyebrow` (text), `armed` (text), `reset`
 *       (attribute value), `shark` (attribute value), `close` (attribute
 *       value), `battery` (text), `charging_group` (attribute value), `system`
 *       (text), `charging_choice` (text), `discharging` (text), `level`
 *       (attribute value), `discharge` (text), `from` (text), `from_decrease`
 *       (attribute value), `percent_unit` (text), `from_increase` (attribute
 *       value), `to` (text), `to_decrease` (attribute value), `to_increase`
 *       (attribute value), `duration` (text), `duration_decrease` (attribute
 *       value), `minutes_unit` (text), `duration_increase` (attribute value),
 *       `start` (text), `stop` (text), `surf` (text), `auction_override`
 *       (attribute value), `natural` (text), `sterile` (text), `page` (text),
 *       `page_prev` (attribute value), `page_next` (attribute value),
 *       `surf_chips` (composed markup, printed through wp_kses).
 */

use ErdemBircan\BatterySurfBench\Support\AllowedHtml;

defined( 'ABSPATH' ) || exit;
?>
<div class="bsb-devtools" data-wp-interactive="battery-surf-bench/cockpit" data-wp-watch---devtools-persist="callbacks.devtoolsPersist" data-wp-watch---devtools-surf-run="callbacks.devtoolsSyncSurfRun" data-wp-init---devtools-surf="callbacks.devtoolsInitSurf" data-devtools-course-slugs="<?php echo esc_attr( $args['course_slugs_json'] ); ?>">
	<div class="bsb-devtools__swap">
		<button type="button" class="bsb-devtools__pill" id="bsb-devtools-pill" data-wp-bind--hidden="state.devtools.open" data-wp-class--is-armed="state.devtoolsIsArmed" data-wp-on--click="actions.devtoolsToggleOpen" aria-expanded="false" data-wp-bind--aria-expanded="state.devtools.open" aria-controls="bsb-devtools-card"><?php echo esc_html( $args['dev'] ); ?></button>

		<div class="bsb-devtools__card" id="bsb-devtools-card" hidden data-wp-bind--hidden="!state.devtools.open">
			<div class="bsb-devtools__card-header">
				<span class="bsb-devtools__card-eyebrow"><?php echo esc_html( $args['eyebrow'] ); ?></span>
				<span class="bsb-devtools__card-armed" hidden data-wp-bind--hidden="!state.devtoolsIsArmed"><?php echo esc_html( $args['armed'] ); ?></span>
				<div class="bsb-devtools__card-actions">
					<button type="button" class="bsb-devtools__card-reset" hidden data-wp-bind--hidden="!state.devtoolsIsArmed" data-wp-on--click="actions.devtoolsReset" aria-label="<?php echo esc_attr( $args['reset'] ); ?>"><span class="bsb-devtools__card-reset-icon" aria-hidden="true"></span></button>
					<button type="button" class="bsb-devtools__card-shark" data-wp-on--click="actions.devtoolsReleaseShark" data-wp-bind--disabled="state.devtoolsSharkDisabled" aria-label="<?php echo esc_attr( $args['shark'] ); ?>"><span class="bsb-devtools__card-shark-icon" aria-hidden="true"></span></button>
					<button type="button" class="bsb-devtools__card-close" data-wp-on--click="actions.devtoolsToggleOpen" aria-label="<?php echo esc_attr( $args['close'] ); ?>">&times;</button>
				</div>
			</div>
			<div class="bsb-devtools__card-divider"></div>

			<div class="bsb-devtools__card-body">
				<div class="bsb-devtools__group">
					<div class="bsb-devtools__group-head">
						<span class="bsb-devtools__group-title"><?php echo esc_html( $args['battery'] ); ?></span>
					</div>
					<div class="bsb-devtools__group-divider"></div>

					<div class="bsb-devtools__group-body" data-wp-class--is-disabled="state.devtoolsIsSimRunning">
						<div class="bsb-devtools__seg" role="group" aria-label="<?php echo esc_attr( $args['charging_group'] ); ?>">
							<button type="button" class="bsb-devtools__seg-option" data-devtools-charging="system" data-wp-class--is-selected="state.devtoolsIsChargingSystem" data-wp-on--click="actions.devtoolsSetCharging" data-wp-bind--disabled="state.devtoolsIsSimRunning"><?php echo esc_html( $args['system'] ); ?></button>
							<button type="button" class="bsb-devtools__seg-option" data-devtools-charging="charging" data-wp-class--is-selected="state.devtoolsIsChargingOn" data-wp-on--click="actions.devtoolsSetCharging" data-wp-bind--disabled="state.devtoolsIsSimRunning"><?php echo esc_html( $args['charging_choice'] ); ?></button>
							<button type="button" class="bsb-devtools__seg-option" data-devtools-charging="discharging" data-wp-class--is-selected="state.devtoolsIsChargingOff" data-wp-on--click="actions.devtoolsSetCharging" data-wp-bind--disabled="state.devtoolsIsSimRunning"><?php echo esc_html( $args['discharging'] ); ?></button>
						</div>

						<div class="bsb-devtools__level" data-wp-class--is-inactive="!state.devtoolsIsLevelForced">
							<button type="button" class="bsb-devtools__seg-option" data-wp-class--is-selected="!state.devtoolsIsLevelForced" data-wp-on--click="actions.devtoolsResetLevel" data-wp-bind--disabled="state.devtoolsIsSimRunning"><?php echo esc_html( $args['system'] ); ?></button>
							<input type="range" min="0" max="100" step="5" aria-label="<?php echo esc_attr( $args['level'] ); ?>" data-wp-bind--value="state.devtoolsLevelPercent" data-wp-style----fill="state.devtoolsLevelFillPercent" data-wp-on--input="actions.devtoolsSetLevel" data-wp-bind--disabled="state.devtoolsIsSimRunning" />
							<span class="bsb-devtools__level-value" data-wp-text="state.devtoolsLevelFillPercent"></span>
						</div>
					</div>
				</div>

				<div class="bsb-devtools__group">
					<div class="bsb-devtools__group-head">
						<span class="bsb-devtools__group-title"><?php echo esc_html( $args['discharge'] ); ?></span>
						<span class="bsb-devtools__group-countdown" hidden data-wp-bind--hidden="!state.devtoolsIsSimRunning" data-wp-text="state.devtoolsSimRemainingDisplay"></span>
					</div>
					<div class="bsb-devtools__group-divider"></div>

					<div class="bsb-devtools__group-body">
						<div class="bsb-devtools__sim-steppers" data-wp-class--is-disabled="state.devtoolsIsSimRunning">
							<div class="bsb-devtools__stepper-row">
								<span class="bsb-devtools__stepper-label"><?php echo esc_html( $args['from'] ); ?></span>
								<div class="bsb-devtools__stepper">
									<button type="button" class="bsb-devtools__stepper-btn" data-devtools-sim-field="from" data-step="-5" data-wp-on--click="actions.devtoolsStepSim" data-wp-bind--disabled="state.devtoolsIsSimRunning" aria-label="<?php echo esc_attr( $args['from_decrease'] ); ?>">&minus;</button>
									<span class="bsb-devtools__stepper-readout"><span data-wp-text="state.devtoolsSimFromDisplay"></span><span class="bsb-devtools__stepper-unit"><?php echo esc_html( $args['percent_unit'] ); ?></span></span>
									<button type="button" class="bsb-devtools__stepper-btn" data-devtools-sim-field="from" data-step="5" data-wp-on--click="actions.devtoolsStepSim" data-wp-bind--disabled="state.devtoolsIsSimRunning" aria-label="<?php echo esc_attr( $args['from_increase'] ); ?>">+</button>
								</div>
							</div>

							<div class="bsb-devtools__stepper-row">
								<span class="bsb-devtools__stepper-label"><?php echo esc_html( $args['to'] ); ?></span>
								<div class="bsb-devtools__stepper">
									<button type="button" class="bsb-devtools__stepper-btn" data-devtools-sim-field="to" data-step="-5" data-wp-on--click="actions.devtoolsStepSim" data-wp-bind--disabled="state.devtoolsIsSimRunning" aria-label="<?php echo esc_attr( $args['to_decrease'] ); ?>">&minus;</button>
									<span class="bsb-devtools__stepper-readout"><span data-wp-text="state.devtoolsSimToDisplay"></span><span class="bsb-devtools__stepper-unit"><?php echo esc_html( $args['percent_unit'] ); ?></span></span>
									<button type="button" class="bsb-devtools__stepper-btn" data-devtools-sim-field="to" data-step="5" data-wp-on--click="actions.devtoolsStepSim" data-wp-bind--disabled="state.devtoolsIsSimRunning" aria-label="<?php echo esc_attr( $args['to_increase'] ); ?>">+</button>
								</div>
							</div>

							<div class="bsb-devtools__stepper-row">
								<span class="bsb-devtools__stepper-label"><?php echo esc_html( $args['duration'] ); ?></span>
								<div class="bsb-devtools__stepper">
									<button type="button" class="bsb-devtools__stepper-btn" data-devtools-sim-field="minutes" data-step="-5" data-wp-on--click="actions.devtoolsStepSim" data-wp-bind--disabled="state.devtoolsIsSimRunning" aria-label="<?php echo esc_attr( $args['duration_decrease'] ); ?>">&minus;</button>
									<span class="bsb-devtools__stepper-readout"><span data-wp-text="state.devtoolsSimMinutesDisplay"></span><span class="bsb-devtools__stepper-unit"><?php echo esc_html( $args['minutes_unit'] ); ?></span></span>
									<button type="button" class="bsb-devtools__stepper-btn" data-devtools-sim-field="minutes" data-step="5" data-wp-on--click="actions.devtoolsStepSim" data-wp-bind--disabled="state.devtoolsIsSimRunning" aria-label="<?php echo esc_attr( $args['duration_increase'] ); ?>">+</button>
								</div>
							</div>
						</div>

						<button type="button" class="bsb-devtools__sim-toggle" data-wp-class--is-running="state.devtoolsIsSimRunning" data-wp-on--click="actions.devtoolsToggleSim" data-wp-bind--disabled="state.devtoolsIsSimStartBlocked">
							<span class="bsb-devtools__sim-toggle-text bsb-devtools__sim-toggle-text--start"><?php echo esc_html( $args['start'] ); ?></span>
							<span class="bsb-devtools__sim-toggle-text bsb-devtools__sim-toggle-text--stop"><?php echo esc_html( $args['stop'] ); ?></span>
						</button>
					</div>
				</div>

				<div class="bsb-devtools__group">
					<div class="bsb-devtools__group-head">
						<span class="bsb-devtools__group-title"><?php echo esc_html( $args['surf'] ); ?></span>
						<span class="bsb-devtools__group-countdown" hidden data-wp-bind--hidden="!state.devtoolsSurfIsRunning" data-wp-text="state.devtoolsSurfCountdownDisplay"></span>
					</div>
					<div class="bsb-devtools__group-divider"></div>

					<div class="bsb-devtools__group-body">
						<div class="bsb-devtools__seg" role="group" aria-label="<?php echo esc_attr( $args['auction_override'] ); ?>">
							<button type="button" class="bsb-devtools__seg-option" data-devtools-surf-mode="natural" data-wp-class--is-selected="state.devtoolsIsSurfNatural" data-wp-on--click="actions.devtoolsSurfSetMode" data-wp-bind--disabled="state.devtoolsSurfModeDisabled"><?php echo esc_html( $args['natural'] ); ?></button>
							<button type="button" class="bsb-devtools__seg-option bsb-devtools__seg-option--sterile" data-devtools-surf-mode="sterile" data-wp-class--is-selected="state.devtoolsIsSurfSterile" data-wp-on--click="actions.devtoolsSurfSetMode" data-wp-bind--disabled="state.devtoolsSurfModeDisabled"><?php echo esc_html( $args['sterile'] ); ?></button>
						</div>

						<div class="bsb-devtools__stepper-row">
							<span class="bsb-devtools__stepper-label"><?php echo esc_html( $args['page'] ); ?></span>
							<div class="bsb-devtools__stepper">
								<button type="button" class="bsb-devtools__stepper-btn" data-step="-1" data-wp-on--click="actions.devtoolsSurfStep" data-wp-bind--disabled="state.devtoolsSurfStepDisabled" aria-label="<?php echo esc_attr( $args['page_prev'] ); ?>">&lsaquo;</button>
								<span class="bsb-devtools__stepper-readout bsb-devtools__stepper-readout--slug" data-wp-text="state.devtoolsSurfPageSlug"></span>
								<button type="button" class="bsb-devtools__stepper-btn" data-step="1" data-wp-on--click="actions.devtoolsSurfStep" data-wp-bind--disabled="state.devtoolsSurfStepDisabled" aria-label="<?php echo esc_attr( $args['page_next'] ); ?>">&rsaquo;</button>
							</div>
						</div>

						<div class="bsb-devtools__chips">
							<?php echo wp_kses( $args['surf_chips'], AllowedHtml::tags() ); ?>

						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>

// Action: nod head (pose). Registers in window.RobotActions['nod'].
window.RobotActions = window.RobotActions || {};

window.RobotActions.nod = {
    duration: Math.PI * 1.5,
    dynamic: false,
    update(ctx) {
        const { t, bones } = ctx;
        const { torsoGroup, headGroup } = bones;
        const nodAngle = Math.sin(t * Math.PI * 2) * 0.4;
        headGroup.rotation.x = nodAngle;
        torsoGroup.rotation.x = nodAngle * 0.3;
    }
};
